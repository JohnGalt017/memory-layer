import { Validator } from "../../../../presentation/protocols/validator.js";
import {
  ParamNameValidator,
  RequiredFieldValidator,
  ValidatorComposite,
} from "../../../../validators/index.js";
import { PathSecurityValidator } from "../../../../validators/path-security-validator.js";

const makeValidations = (): Validator[] => {
  return [
    new RequiredFieldValidator("projectName"),
    new RequiredFieldValidator("query"),
    new ParamNameValidator("projectName"),
    new PathSecurityValidator("projectName"),
  ];
};

export const makeSearchValidation = (): Validator => {
  const validations = makeValidations();
  return new ValidatorComposite(validations);
};
