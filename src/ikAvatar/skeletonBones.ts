import { Bone } from "@babylonjs/core/Bones/bone";
import { Skeleton } from "@babylonjs/core/Bones/skeleton";

export enum BoneIndex
{
    NECK,
    HEAD,
    LEFT_SHOULDER,
    LEFT_ELBOW,
    LEFT_WRIST,
    RIGHT_SHOULDER,
    RIGHT_ELBOW,
    RIGHT_WRIST
}

export class SkeletonBones
{
    private bones: Map<BoneIndex, Bone> = new Map<BoneIndex, Bone>();

    constructor(skeleton: Skeleton,
        neckBoneName: string,
        headBoneName: string,
        leftShoulderBoneName: string,
        leftElbowBoneName: string,
        leftWristBoneName: string,
        rightShoulderBoneName: string,
        rightElbowBoneName: string,
        rightWristBoneName: string)
    {
        let allBonesFound: boolean = true;

        const neckBone: Bone = skeleton.bones[skeleton.getBoneIndexByName(neckBoneName)];
        allBonesFound = allBonesFound && neckBone != null;
        const headBone: Bone = skeleton.bones[skeleton.getBoneIndexByName(headBoneName)];
        allBonesFound = allBonesFound && headBone != null;

        const leftShoulderBone: Bone = skeleton.bones[skeleton.getBoneIndexByName(leftShoulderBoneName)];
        allBonesFound = allBonesFound && leftShoulderBone != null;
        const leftElbowBone: Bone = skeleton.bones[skeleton.getBoneIndexByName(leftElbowBoneName)];
        allBonesFound = allBonesFound && leftElbowBone != null;
        const leftWristBone: Bone = skeleton.bones[skeleton.getBoneIndexByName(leftWristBoneName)];
        allBonesFound = allBonesFound && leftWristBone != null;

        const rightShoulderBone: Bone = skeleton.bones[skeleton.getBoneIndexByName(rightShoulderBoneName)];
        allBonesFound = allBonesFound && rightShoulderBone != null;
        const rightElbowBone: Bone = skeleton.bones[skeleton.getBoneIndexByName(rightElbowBoneName)];
        allBonesFound = allBonesFound && rightElbowBone != null;
        const rightWristBone: Bone = skeleton.bones[skeleton.getBoneIndexByName(rightWristBoneName)];
        allBonesFound = allBonesFound && rightWristBone != null;

        if (allBonesFound)
        {
            this.bones.set(BoneIndex.NECK, neckBone);
            this.bones.set(BoneIndex.HEAD, headBone);

            this.bones.set(BoneIndex.LEFT_SHOULDER, leftShoulderBone);
            this.bones.set(BoneIndex.LEFT_ELBOW, leftElbowBone);
            this.bones.set(BoneIndex.LEFT_WRIST, leftWristBone);

            this.bones.set(BoneIndex.RIGHT_SHOULDER, rightShoulderBone);
            this.bones.set(BoneIndex.RIGHT_ELBOW, rightElbowBone);
            this.bones.set(BoneIndex.RIGHT_WRIST, rightWristBone);
        }
        else
        {
            throw new Error("SkeletonTransforms() failed. Unable to find bone(s) of the given name.");
        }
    }

    getBone(index: BoneIndex): Bone
    {
        return this.bones.get(index)!;
    }
}
