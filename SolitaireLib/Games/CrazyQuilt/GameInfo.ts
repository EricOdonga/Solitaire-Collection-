import { IGameInfo } from "~CardLib/IGameInfo";
import { GamePresenterFactory } from "./Presenter/GamePresenterFactory";

class GameInfo implements IGameInfo {
    public gameId = "crazyquilt";
    public gameName = "Crazy Quilt";
    public gamePresenterFactory = new GamePresenterFactory();
}

export default new GameInfo();
