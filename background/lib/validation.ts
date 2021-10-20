import Ajv, { JSONSchemaType } from "ajv"
import AjvJTD, { JTDDataType } from "ajv/dist/jtd"
import AjvJSONSchema from "ajv/dist/2019"
import { ValidateFunction } from "ajv/dist/types"

let ajvJTD: Ajv
let ajvJSONSchema: Ajv

function getAjv() {
  return {
    ajvJTD: ajvJTD || new AjvJTD(),
    ajvJSONSchema: ajvJSONSchema || new AjvJSONSchema(),
  }
}

// The type returned by Ajv validator functions, but without the schemaEnv
// property. Our code does not use it, and its non-optional and Ajv-internal
// nature makes our lazy wrapping difficult to implement correctly.
type EnvlessValidateFunction<T> = ((json: unknown) => json is T) &
  Omit<ValidateFunction<T> | ValidateFunction<JTDDataType<T>>, "schemaEnv">

/**
 * Returns a lazily-compiled JTD validator from a central Ajv instance.
 */
export function jtdValidatorFor<SchemaType>(
  jtdDefinition: SchemaType
): EnvlessValidateFunction<JTDDataType<SchemaType>> {
  let compiled: ValidateFunction<JTDDataType<SchemaType>> | null = null

  const wrapper: EnvlessValidateFunction<JTDDataType<SchemaType>> =
    Object.assign(
      (json: unknown): json is JTDDataType<SchemaType> => {
        try {
          compiled =
            compiled ||
            getAjv().ajvJTD.compile<JTDDataType<SchemaType>>(jtdDefinition)

          const result = compiled(json)
          // Copy errors and such, which Ajv carries on the validator function
          // object itself.
          Object.assign(wrapper, result)

          return result
        } catch (error) {
          // If there's a compilation error, communicate it in a way that
          // aligns with Ajv's typical way of communicating validation errors,
          // and report the JSON as invalid (since we can't know for sure).
          wrapper.errors = [
            {
              keyword: "COMPILATION FAILURE",
              params: { error },
              instancePath: "",
              schemaPath: "",
            },
          ]

          return false
        }
      },
      { schema: jtdDefinition }
    )

  return wrapper
}

/**
 * Returns a lazily-compiled JSON Schema validator from a central Ajv instance.
 */
export function jsonSchemaValidatorFor<T>(
  jsonSchemaDefinition: JSONSchemaType<T>
): EnvlessValidateFunction<T> {
  let compiled: ValidateFunction<T> | null = null

  const wrapper: EnvlessValidateFunction<T> = Object.assign(
    (json: unknown): json is T => {
      try {
        compiled =
          compiled || getAjv().ajvJSONSchema.compile<T>(jsonSchemaDefinition)
        const result = compiled(json)
        // Copy errors and such, which Ajv carries on the validator function
        // object itself.
        Object.assign(wrapper, result)

        return result
      } catch (error) {
        // If there's a compilation error, communicate it in a way that
        // aligns with Ajv's typical way of communicating validation errors,
        // and report the JSON as invalid (since we can't know for sure).
        wrapper.errors = [
          {
            keyword: "COMPILATION FAILURE",
            params: { error },
            instancePath: "",
            schemaPath: "",
          },
        ]

        return false
      }
    },
    { schema: jsonSchemaDefinition }
  )

  return wrapper
}
