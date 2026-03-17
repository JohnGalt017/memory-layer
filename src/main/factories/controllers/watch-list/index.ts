import { WatchListController } from "../../../../presentation/controllers/watch-list/watch-list-controller.js";
import { WatchList } from "../../../../data/usecases/watch-list/watch-list.js";
import {
  configRepo,
  pendingRepo,
  watcherRegistry,
} from "../../../services/watcher-singletons.js";

export const makeWatchListController = () => {
  const useCase = new WatchList(configRepo, pendingRepo, watcherRegistry);
  return new WatchListController(useCase);
};
