const schema = `
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": "https://gitlab.zayo.com/tranzact/tz-cacher/schemas/cacheoptions.json",
    "type": "object",
    "properties": {
      "ttl": {
        "$ref": "defs.json#/definitions/ttl",
        "description": "The default TTL for all methods"
      },
      "buckets": {
        "$ref": "defs.json#/definitions/buckets",
        "description": "The default bucket(s) for the cached object."
      },
      "methods": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "$ref": "defs.json#/definitions/methodName" },
            "type": { "$ref": "defs.json#/definitions/methodType" }
          },
          "required": [ "name", "type" ],
          "allOf": [
            {
              "if": {
                "properties": { "type": { "const": "cacheable" } }
              },
              "then": {
                "properties": {
                  "name": { "$ref": "defs.json#/definitions/methodName" },
                  "type": { "$ref": "defs.json#/definitions/methodType" },
                  "ttl": { "$ref": "defs.json#/definitions/ttl" },
                  "buckets": { "$ref": "defs.json#/definitions/buckets" }
                },
                "additionalProperties": false
              }
            },
            {
              "if": {
                "properties": { "type": { "const": "passthrough" } }
              },
              "then": {
                "properties": {
                  "name": { "$ref": "defs.json#/definitions/methodName" },
                  "type": { "$ref": "defs.json#/definitions/methodType" }
                },
                "additionalProperties": false
              }
            },
            {
              "if": {
                "properties": { "type": { "const": "mutator" } }
              },
              "then": {
                "properties": {
                  "name": { "$ref": "defs.json#/definitions/methodName" },
                  "type": { "$ref": "defs.json#/definitions/methodType" },
                  "buckets": { "$ref": "defs.json#/definitions/buckets" }
                },
                "required": [ "buckets" ],
                "additionalProperties": false
              }
            }
          ]
        }
      }
    },
    "required": [ "ttl", "buckets" ],
    "additionalProperties": false
  }  
`;

module.exports = schema;
