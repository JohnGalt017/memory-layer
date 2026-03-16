import { Controller, Request, Response, Validator } from "../../protocols/index.js";
import { QueryFilesUseCase } from "../../../domain/usecases/index.js";
export interface QueryRequest {
  projectName?: string;
  type?: string;
  status?: string;
  tags?: string[];
  updatedAfter?: string;
  maxResults?: number;
}
export type QueryResponse = string;
export { Controller, Request, Response, Validator, QueryFilesUseCase };
