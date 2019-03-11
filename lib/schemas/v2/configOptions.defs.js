const MIN_TTL = parseInt(process.env.MIN_TTL, 10) || 5; // 5 sec by default
const MAX_TTL = parseInt(process.env.MAX_TTL, 10) || 86400; // 24 hrs by default
/* Maximum length of the bucket name including the name of the app if any. */
const MAX_BUCKET_NAME_SIZE = parseInt(process.env.MAX_BUCKET_NAME_SIZE, 10) || 50;
/* Maximum buckets allowed per cached item */
const MAX_BUCKETS = parseInt(process.env.MAX_BUCKETS, 10) || 25;

const schema = `
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": "https://gitlab.zayo.com/tranzact/tz-cacher/schemas/defs.json",
    "definitions": {
        "ttl": {
          "type": "integer",
          "minimum": ${MIN_TTL},
          "maximum": ${MAX_TTL}
        },
        "bucketItem": {
          "type": "string",
          "minLength": 1,
          "maxLength": ${MAX_BUCKET_NAME_SIZE},
          "pattern": "^(([\\\\w\\\\-]+\\\\.)?[\\\\w\\\\-]+)|\\\\*|([\\\\w\\\\-]+\\\\.\\\\*)$"
        },
        "methodName": {
          "type": "string",
          "pattern": "^[_A-Za-z][\\\\w]*$"
        },
        "methodType": {
          "enum": [ "cacheable", "passthrough", "mutator" ]
        },
        "buckets": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/bucketItem"
          },
          "minItems": 1,
          "maxItems": ${MAX_BUCKETS},
          "uniqueItems": true
        }
      }
}
`;

module.exports = schema;
