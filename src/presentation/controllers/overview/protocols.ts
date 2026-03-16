import { Controller, Request, Response, Validator } from "../../protocols/index.js";
import { OverviewUseCase } from "../../../domain/usecases/index.js";
export interface OverviewRequest { projectName?: string; }
export type OverviewResponse = string;
export { Controller, Request, Response, Validator, OverviewUseCase };
