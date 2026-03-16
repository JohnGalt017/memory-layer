import { Controller, Request, Response, Validator } from "../../protocols/index.js";
import { AppendFileUseCase } from "../../../domain/usecases/index.js";
export interface AppendRequest { projectName: string; fileName: string; content: string; }
export type AppendResponse = string;
export { Controller, Request, Response, Validator, AppendFileUseCase };
