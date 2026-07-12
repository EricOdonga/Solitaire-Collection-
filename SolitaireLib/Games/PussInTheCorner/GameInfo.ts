import { IGameInfo } from "~CardLib/IGameInfo";
import { GamePresenterFactory } from "./Presenter/GamePresenterFactory";

class GameInfo implements IGameInfo {
    public gameId = "pussinthecorner";
    public gameName = "Puss in the Corner";
    public gamePresenterFactory = new GamePresenterFactory();
}

export default new GameInfo();
