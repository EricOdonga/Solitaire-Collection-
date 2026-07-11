import { IGameInfo } from "~CardLib/IGameInfo";
import { GamePresenterFactory } from "./Presenter/GamePresenterFactory";

class GameInfo implements IGameInfo {
    public gameId = "scorpion";
    public gameName = "Scorpion";
    public gamePresenterFactory = new GamePresenterFactory();
}

export default new GameInfo();
