import { IGameInfo } from "~CardLib/IGameInfo";
import { GamePresenterFactory } from "./Presenter/GamePresenterFactory";

class GameInfo implements IGameInfo {
    public gameId = "osmosis";
    public gameName = "Osmosis";
    public gamePresenterFactory = new GamePresenterFactory();
}

export default new GameInfo();
