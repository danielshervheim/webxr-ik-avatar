import { Skeleton } from "@babylonjs/core/Bones/skeleton";

// A place to consolidate the animation names required by calibration avatar.
export class CalibrationAnimationDictionary
{
    private idle: string;
    private tPose: string;
    private handsOnShoulders: string;
    private finish: string;

    constructor(idle: string, tPose: string, handsOnShoulders: string, finish: string)
    {
        this.idle = idle;
        this.tPose = tPose;
        this.handsOnShoulders = handsOnShoulders;
        this.finish = finish;
    }

    public getIdle() : string
    {
        return this.idle;
    }

    public getTPose() : string
    {
        return this.tPose;
    }

    public getHandsOnShoulders() : string
    {
        return this.handsOnShoulders;
    }

    public getFinish() : string
    {
        return this.finish;
    }

    // Returns wether or not the skeleton contains a valid animation range for
    // each animation required by the calibration avatar.
    public skeletonContainsAnimations(skeleton: Skeleton) : boolean
    {
        if (!skeleton)
        {
            return false;
        }

        let foundIdle: boolean = false;
        let foundTPose: boolean = false;
        let foundHandsOnShoulders: boolean = false;
        let foundFinish: boolean = false;

        for (let range of skeleton.getAnimationRanges())
        {
            if (!range)
            {
                continue;
            }

            foundIdle = foundIdle || (range.name == this.idle);
            foundTPose = foundTPose || (range.name == this.tPose);
            foundHandsOnShoulders = foundHandsOnShoulders || (range.name == this.handsOnShoulders);
            foundFinish = foundFinish || (range.name == this.finish);
        }

        return foundIdle && foundTPose && foundHandsOnShoulders && foundFinish;
    }
}
