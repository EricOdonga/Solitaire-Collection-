import { IGameInfo } from "~CardLib/IGameInfo";
import { GamePresenterFactory } from "./Presenter/GamePresenterFactory";

class GameInfo implements IGameInfo {
    public gameId = "labellelucie";
    public gameName = "La Belle Lucie";
    public gamePresenterFactory = new GamePresenterFactory();
}

export default new GameInfo();
