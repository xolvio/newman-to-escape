# Newman to Escape Hotstart Configuration Converter

This tool converts a Newman collection to an Escape YAML hotstart configuration. It processes GraphQL queries from a Postman collection, inlines environment variables, and generates a YAML file compatible with Escape's hotstart feature.

## Installation

1. Clone this repository.
2. Run `npm install` to install dependencies.

## Usage

Run the script with the following command:

```bash
node index.js -c <path-to-collection> -e <path-to-environment>
```

### Options

- `-c, --collection <string>`: Path to the Newman collection JSON file (required)
- `-e, --environment <string>`: Path to the Newman environment JSON file (required)

### Example

```bash
node index.js -c ./my-collection.json -e ./my-environment.json
```

This will generate a file named `my-collection.hotstart.yaml` in the current directory.

## Output

The script generates a YAML file with the following structure:

```yaml
scan:
  hotstart:
  - "query { example { field1 field2 } }"
  - "mutation { updateExample(input: { id: 123, value: \"test\" }) { success } }"
```
