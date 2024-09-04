const { parse, print, visit } = require("graphql");
const fs = require("fs").promises;
const { program } = require("commander");
const yaml = require("js-yaml");
const newman = require("newman");
const path = require("path");

program
  .name("newman-to-escape")
  .description(
    "Convert a Newman collection to an Escape YAML hotstart configuration",
  )
  .requiredOption(
    "-c, --collection <string>",
    "Path to the Newman collection JSON file",
  )
  .requiredOption(
    "-e, --environment <string>",
    "Path to the Newman environment JSON file",
  )
  .action((options) => run(options));

program.parse(process.argv);

function inlineEnvironmentVariables(query, variables, env) {
  const ast = parse(query);
  const newAst = visit(ast, {
    VariableDefinition(node) {
      const varName = node.variable.name.value;
      let value = JSON.parse(variables)[varName];
      if (process.env.DEBUG) {
        console.log("varName", varName);
        console.log("variables", variables);
        console.log("value", value);
      }
      return {
        ...node,
        defaultValue: valueToAST(value),
      };
    },
  });
  return print(newAst);
}

function valueToAST(value) {
  if (typeof value === "string") {
    return { kind: "StringValue", value };
  } else if (typeof value === "number") {
    return { kind: "IntValue", value: value.toString() };
  } else if (typeof value === "boolean") {
    return { kind: "BooleanValue", value };
  } else if (value === null) {
    return { kind: "NullValue" };
  } else if (Array.isArray(value)) {
    return { kind: "ListValue", values: value.map(valueToAST) };
  } else if (typeof value === "object") {
    return {
      kind: "ObjectValue",
      fields: Object.entries(value).map(([k, v]) => ({
        kind: "ObjectField",
        name: { kind: "Name", value: k },
        value: valueToAST(v),
      })),
    };
  }
  throw new Error(`Unsupported value type: ${typeof value}`);
}

async function runNewmanCollection(collectionPath, envPath) {
  const collectionData = await fs.readFile(collectionPath, "utf8");
  const envData = await fs.readFile(envPath, "utf8");

  return new Promise((resolve, reject) => {
    newman.run(
      {
        collection: JSON.parse(collectionData),
        environment: JSON.parse(envData),
        reporters: "cli",
      },
      (err, summary) => {
        if (err) reject(err);
        const graphqlRequests = summary.run.executions
          .filter(
            (exec) => exec.request.body && exec.request.body.mode === "graphql",
          )
          .map((exec) => ({
            request: {
              body: exec.request.body.graphql,
            },
            response: {
              body: exec.response.stream.toString(),
            },
          }));
        resolve(graphqlRequests);
      },
    );
  });
}

async function generateHotstartConfig(collectionPath, envPath) {
  const envData = await fs.readFile(envPath, "utf8");
  const env = JSON.parse(envData);

  const graphqlRequests = await runNewmanCollection(collectionPath, envPath);

  const inlinedOperations = graphqlRequests.map(({ request }) => {
    const query = request.body.query;
    const variables = request.body.variables;
    if (process.env.DEBUG) {
      console.log("query");
      console.log(query);
      console.log("variables");
      console.log(variables);
    }
    return variables
      ? inlineEnvironmentVariables(query, variables, env)
      : query;
  });

  const hotstartYaml = {
    scan: {
      hotstart: inlinedOperations.map((query) =>
        query.replace(/\n/g, " ").trim(),
      ),
    },
  };

  return hotstartYaml;
}

async function run(args) {
  console.log("Processing Newman collection...");
  const hotstartYaml = await generateHotstartConfig(
    args.collection,
    args.environment,
  );

  const yamlString = yaml.dump(hotstartYaml, {
    flowLevel: 3,
    quotingType: '"',
    forceQuotes: true,
  });

  console.log(yamlString);

  const outputFile = path.basename(args.collection, ".json") + ".hotstart.yaml";
  await fs.writeFile(outputFile, yamlString);

  console.log(
    `Escape hotstart configuration generated successfully at: ${outputFile}`,
  );
}

module.exports = { run };
