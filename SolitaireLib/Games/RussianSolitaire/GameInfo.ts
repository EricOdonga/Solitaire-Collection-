import { IGameInfo } from "~CardLib/IGameInfo";
import { GamePresenterFactory } from "./Presenter/GamePresenterFactory";

class GameInfo implements IGameInfo {
    public gameId = "russiansolitaire";
    public gameName = "Russian Solitaire";
    public gamePresenterFactory = new GamePresenterFactory();
}

export default new GameInfo();
