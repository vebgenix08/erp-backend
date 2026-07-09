export interface ValidationSuccess<T> {
  success: true;
  value: T;
}

export interface ValidationFailure {
  success: false;
  errors: string[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export function validationOk<T>(value: T): ValidationSuccess<T> {
  return { success: true, value };
}

export function validationFail(errors: string[] | string): ValidationFailure {
  return { success: false, errors: Array.isArray(errors) ? errors : [errors] };
}

export function isValidationSuccess<T>(result: ValidationResult<T>): result is ValidationSuccess<T> {
  return result.success;
}
