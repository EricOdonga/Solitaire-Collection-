import { IGameInfo } from "~CardLib/IGameInfo";
import { GamePresenterFactory } from "./Presenter/GamePresenterFactory";

class GameInfo implements IGameInfo {
    public gameId = "streetsandalleys";
    public gameName = "Streets and Alleys";
    public gamePresenterFactory = new GamePresenterFactory();
}

export default new GameInfo();
