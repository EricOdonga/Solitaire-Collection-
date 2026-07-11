import { IGameInfo } from "~CardLib/IGameInfo";
import { GamePresenterFactory } from "./Presenter/GamePresenterFactory";

class GameInfo implements IGameInfo {
    public gameId = "fortyeight";
    public gameName = "FortyEight";
    public gamePresenterFactory = new GamePresenterFactory();
}

export default new GameInfo();
