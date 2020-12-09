export enum Side { LEFT, RIGHT };

// A place to consolidate the bone names required by the IK system.
export class BoneDictionary
{
    private armR: string;
    private foreArmR: string;
    private handR: string;
    private indexR: string;

    private armL: string;
    private foreArmL: string;
    private handL: string;
    private indexL: string;

    constructor(armR: string, foreArmR: string, handR: string, indexR: string, armL: string, foreArmL: string, handL: string, indexL: string)
    {
        this.armR = armR;
        this.foreArmR = foreArmR;
        this.handR = handR;
        this.indexR = indexR;
        this.armL = armL;
        this.foreArmL = foreArmL;
        this.handL = handL;
        this.indexL = indexL;
    }

    public getArmName(side: Side) : string
    {
        return side == Side.LEFT ? this.armL : this.armR;
    }

    public getForeArmName(side: Side) : string
    {
        return side == Side.LEFT ? this.foreArmL : this.foreArmR;
    }

    public getHandName(side: Side) : string
    {
        return side == Side.LEFT ? this.handL : this.handR;
    }

    public getIndexName(side: Side) : string
    {
        return side == Side.LEFT ? this.indexL : this.indexR;
    }
}
