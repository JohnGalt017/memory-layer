import { Controller, Request, Response, Validator } from "../../protocols/index.js";
import { UpsertFileUseCase } from "../../../domain/usecases/index.js";

export interface UpsertRequest {
  projectName: string;
  fileName: string;
  content: string;
}
export type UpsertResponse = string;
export { Controller, Request, Response, Validator, UpsertFileUseCase };
