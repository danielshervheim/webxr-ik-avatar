import { Skeleton } from "@babylonjs/core/Bones/skeleton";

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

    private head: string;

    constructor(armR: string, foreArmR: string, handR: string, indexR: string, armL: string, foreArmL: string, handL: string, indexL: string, head: string)
    {
        this.armR = armR;
        this.foreArmR = foreArmR;
        this.handR = handR;
        this.indexR = indexR;
        this.armL = armL;
        this.foreArmL = foreArmL;
        this.handL = handL;
        this.indexL = indexL;
        this.head = head;
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

    public getHeadName() : string
    {
        return this.head;
    }

    public validateSkeleton(skeleton: Skeleton) : boolean
    {
        const toCheck = [this.armR, this.foreArmR, this.handR, this.indexR, this.armL, this.foreArmL, this.handL, this.indexL, this.head];
        for (let name of toCheck)
        {
            const index = skeleton.getBoneIndexByName(name);
            const bone = skeleton.bones[index];
            if (!bone)
            {
                console.error("ERROR - BoneDictionary.validateSkeleton. No bone found with name: " + name);
                return false;
            }
        }
        return true;
    }
}
