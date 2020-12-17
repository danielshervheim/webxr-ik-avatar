// Babylon imports.
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";

import { AvatarMeasurements } from "./avatarMeasurements";

import { Utilities } from "../utilities";

export enum TransformIndex
{
    ROOT,
    HEAD,
    LEFT_SHOULDER,
    LEFT_ELBOW,
    LEFT_WRIST,
    RIGHT_SHOULDER,
    RIGHT_ELBOW,
    RIGHT_WRIST
}

const DEFAULT_HEIGHT = 1.68;
const DEFAULT_EYE_HEIGHT = DEFAULT_HEIGHT * 0.9333;

export class AvatarTransforms
{
    private scene: Scene;

    private nodes: Map<TransformIndex, TransformNode>;

    private measurements: AvatarMeasurements;

    constructor(scene: Scene)
    {
        this.scene = scene;
        this.nodes = new Map<TransformIndex, TransformNode>();
        this.measurements = new AvatarMeasurements(DEFAULT_EYE_HEIGHT);


        const root = new TransformNode("avatar_root", this.scene);
        Utilities.ResetTransform(root);
        this.nodes.set(TransformIndex.ROOT, root);

        const head = new TransformNode("avatar_head", this.scene);
        head.setParent(root);
        Utilities.ResetTransform(head);
        this.nodes.set(TransformIndex.HEAD, head);

        const leftShoulder = new TransformNode("avatar_leftShoulder", this.scene);
        leftShoulder.setParent(root);
        Utilities.ResetTransform(leftShoulder);
        this.nodes.set(TransformIndex.LEFT_SHOULDER, leftShoulder);

        const leftElbow = new TransformNode("avatar_leftElbow", this.scene);
        leftElbow.setParent(leftShoulder);
        Utilities.ResetTransform(leftElbow);
        this.nodes.set(TransformIndex.LEFT_ELBOW, leftElbow);

        const leftWrist = new TransformNode("avatar_leftWrist", this.scene);
        leftWrist.setParent(leftElbow);
        Utilities.ResetTransform(leftWrist);
        this.nodes.set(TransformIndex.LEFT_WRIST, leftWrist);

        const rightShoulder = new TransformNode("avatar_rightShoulder", this.scene);
        rightShoulder.setParent(root);
        Utilities.ResetTransform(rightShoulder);
        this.nodes.set(TransformIndex.RIGHT_SHOULDER, rightShoulder);

        const rightElbow = new TransformNode("avatar_rightElbow", this.scene);
        rightElbow.setParent(rightShoulder);
        Utilities.ResetTransform(rightElbow);
        this.nodes.set(TransformIndex.RIGHT_ELBOW, rightElbow);

        const rightWrist = new TransformNode("avatar_rightWrist", this.scene);
        rightWrist.setParent(rightElbow);
        Utilities.ResetTransform(rightWrist);
        this.nodes.set(TransformIndex.RIGHT_WRIST, rightWrist);

        // ...and calibrate it with a default height of 5'6".
        this.calibrateFromEyeHeight(DEFAULT_EYE_HEIGHT);
    }

    calibrateFromEyeHeight(eyeHeight: number): void
    {
        console.log("AvatarTransforms.calibrateFromEyeHeight(). eyeHeight = " + eyeHeight);

        this.measurements.deriveFromEyeHeight(eyeHeight);

        const root = this.nodes.get(TransformIndex.ROOT)!;
        const head = this.nodes.get(TransformIndex.HEAD)!;
        const leftShoulder = this.nodes.get(TransformIndex.LEFT_SHOULDER)!;
        const leftElbow = this.nodes.get(TransformIndex.LEFT_ELBOW)!;
        const leftWrist = this.nodes.get(TransformIndex.LEFT_WRIST)!;
        const rightShoulder = this.nodes.get(TransformIndex.RIGHT_SHOULDER)!;
        const rightElbow = this.nodes.get(TransformIndex.RIGHT_ELBOW)!;
        const rightWrist = this.nodes.get(TransformIndex.RIGHT_WRIST)!;

        root.position = new Vector3(root.position.x, this.measurements.shoulderHeight, root.position.z);
        head.position = new Vector3(0, this.measurements.shoulderToEyeOffset, 0);

        leftShoulder.position = new Vector3(this.measurements.leftShoulderOffset, 0, 0);
        leftElbow.position = new Vector3(-this.measurements.upperArmLength, 0, 0);
        leftWrist.position = new Vector3(-this.measurements.foreArmLength, 0, 0);

        rightShoulder.position = new Vector3(this.measurements.rightShoulderOffset, 0, 0);
        rightElbow.position = new Vector3(this.measurements.upperArmLength, 0, 0);
        rightWrist.position = new Vector3(this.measurements.foreArmLength, 0, 0);
    }

    setArmLengthsFromArmspan(armSpan: number): void
    {
        console.log("AvatarTransforms.setArmLengthsFromArmspan(). armSpan = " + armSpan);

        this.measurements.deriveArmLengthsFromArmSpan(armSpan);

        const leftElbow = this.nodes.get(TransformIndex.LEFT_ELBOW)!;
        const leftWrist = this.nodes.get(TransformIndex.LEFT_WRIST)!;
        const rightElbow = this.nodes.get(TransformIndex.RIGHT_ELBOW)!;
        const rightWrist = this.nodes.get(TransformIndex.RIGHT_WRIST)!;

        leftElbow.position = new Vector3(-this.measurements.upperArmLength, 0, 0);
        leftWrist.position = new Vector3(-this.measurements.foreArmLength, 0, 0);

        rightElbow.position = new Vector3(this.measurements.upperArmLength, 0, 0);
        rightWrist.position = new Vector3(this.measurements.foreArmLength, 0, 0);
    }

    getNode(index: TransformIndex): TransformNode
    {
        return this.nodes.get(index)!;
    }

    getNodes(): Array<TransformNode>
    {
        return [
            this.nodes.get(TransformIndex.ROOT)!,
            this.nodes.get(TransformIndex.HEAD)!,
            this.nodes.get(TransformIndex.LEFT_SHOULDER)!,
            this.nodes.get(TransformIndex.LEFT_ELBOW)!,
            this.nodes.get(TransformIndex.LEFT_WRIST)!,
            this.nodes.get(TransformIndex.RIGHT_SHOULDER)!,
            this.nodes.get(TransformIndex.RIGHT_ELBOW)!,
            this.nodes.get(TransformIndex.RIGHT_WRIST)!
        ];
    }

    getLeftArmChain(): Array<TransformNode>
    {
        return [
            this.nodes.get(TransformIndex.LEFT_SHOULDER)!,
            this.nodes.get(TransformIndex.LEFT_ELBOW)!,
            this.nodes.get(TransformIndex.LEFT_WRIST)!
        ];
    }

    getLeftArmLimits(): Array<number>
    {
        return [Math.PI, Math.PI, Math.PI];
    }

    getRightArmChain(): Array<TransformNode>
    {
        return [
            this.nodes.get(TransformIndex.RIGHT_SHOULDER)!,
            this.nodes.get(TransformIndex.RIGHT_ELBOW)!,
            this.nodes.get(TransformIndex.RIGHT_WRIST)!
        ];
    }

    getRightArmLimits(): Array<number>
    {
        return [Math.PI, Math.PI, Math.PI];
    }

    getHeight(): number
    {
        return this.measurements.height;
    }

    getUpperArmLength(): number
    {
        return this.measurements.upperArmLength;

    }

    getLowerArmLength(): number
    {
        return this.measurements.foreArmLength;

    }

}
