export type {
  ValidationFailure,
  ValidationResult,
  ValidationSuccess,
} from "./result";
export {
  isValidationSuccess,
  validationFail,
  validationOk,
} from "./result";
export {
  isNonEmptyString,
  optionalString,
  validateEmail,
  validateNonEmptyString,
  validateObjectIdPlaceholder,
  validatePhone,
} from "./schemas";
