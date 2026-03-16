import { Controller, Request, Response, Validator } from "../../protocols/index.js";
import { SearchFilesUseCase } from "../../../domain/usecases/index.js";
export interface SearchRequest { projectName: string; query: string; }
export type SearchResponse = string;
export { Controller, Request, Response, Validator, SearchFilesUseCase };
