import path from "path";
import { Validator } from "../presentation/protocols/validator.js";
import { InvalidParamError } from "../presentation/errors/index.js";

export class AbsolutePathValidator implements Validator {
  constructor(private readonly fieldName: string) {}

  validate(input?: any): Error | null {
    if (!input?.[this.fieldName]) return null;
    if (!path.isAbsolute(input[this.fieldName])) {
      return new InvalidParamError(`${this.fieldName} must be an absolute path`);
    }
    return null;
  }
}
