import { IGameInfo } from "~CardLib/IGameInfo";
import { GamePresenterFactory } from "./Presenter/GamePresenterFactory";

class GameInfo implements IGameInfo {
    public gameId = "spiderette";
    public gameName = "Spiderette";
    public gamePresenterFactory = new GamePresenterFactory();
}

export default new GameInfo();
