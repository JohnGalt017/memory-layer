import {
  PatchFileResult,
  PatchFileUseCase,
} from "../../../domain/usecases/patch-file.js";
import {
  Controller,
  Request,
  Response,
  Validator,
} from "../../protocols/index.js";

export interface PatchRequest {
  projectName: string;
  fileName: string;
  oldText: string;
  newText: string;
  expectedReplacements?: number;
}

export type PatchResponse = string;
export type RequestValidator = Validator;

export {
  Controller,
  PatchFileResult,
  PatchFileUseCase,
  Request,
  Response,
};
