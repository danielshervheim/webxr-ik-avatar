// Babylon imports.
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";

import { AvatarMeasurements } from "./avatarMeasurements";

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

export class AvatarTransforms
{
    private scene: Scene;

    private nodes: Map<TransformIndex, TransformNode>;

    private mostRecentMeasurements: AvatarMeasurements | null = null;

    constructor(scene: Scene)
    {
        this.scene = scene;
        this.nodes = new Map<TransformIndex, TransformNode>();

        // TODO: note, the specific rotations are to match the skeleton imported
        // by the user. This is not robust and should be changed to be more flexible.

        // Setup skeleton hierarchy...
        const root = new TransformNode("avatar_root", this.scene);
        root.rotation = Vector3.Zero();
        this.nodes.set(TransformIndex.ROOT, root);

        const head = new TransformNode("avatar_head", this.scene);
        head.setParent(root);
        head.rotation = Vector3.Zero();
        this.nodes.set(TransformIndex.HEAD, head);

        const leftShoulder = new TransformNode("avatar_leftShoulder", this.scene);
        leftShoulder.setParent(root);
        leftShoulder.rotation = new Vector3(0, 0, Math.PI/2.0);
        // leftShoulder.rotation = Vector3.Zero();
        this.nodes.set(TransformIndex.LEFT_SHOULDER, leftShoulder);

        const leftElbow = new TransformNode("avatar_leftElbow", this.scene);
        leftElbow.setParent(leftShoulder);
        leftElbow.rotation = Vector3.Zero();
        this.nodes.set(TransformIndex.LEFT_ELBOW, leftElbow);

        const leftWrist = new TransformNode("avatar_leftWrist", this.scene);
        leftWrist.setParent(leftElbow);
        leftWrist.rotation = Vector3.Zero();
        this.nodes.set(TransformIndex.LEFT_WRIST, leftWrist);

        const rightShoulder = new TransformNode("avatar_rightShoulder", this.scene);
        rightShoulder.setParent(root);
        rightShoulder.rotation = new Vector3(0, 0, -Math.PI/2.0);
        // rightShoulder.rotation = Vector3.Zero();
        this.nodes.set(TransformIndex.RIGHT_SHOULDER, rightShoulder);

        const rightElbow = new TransformNode("avatar_rightElbow", this.scene);
        rightElbow.setParent(rightShoulder);
        rightElbow.rotation = Vector3.Zero();
        this.nodes.set(TransformIndex.RIGHT_ELBOW, rightElbow);

        const rightWrist = new TransformNode("avatar_rightWrist", this.scene);
        rightWrist.setParent(rightElbow);
        rightWrist.rotation = Vector3.Zero();
        this.nodes.set(TransformIndex.RIGHT_WRIST, rightWrist);

        // ...and calibrate it with a default height of 5'6".
        this.calibrateFromEyeHeight(DEFAULT_HEIGHT*0.9333);
    }

    calibrateFromEyeHeight(eyeHeight: number): void
    {
        console.log("AvatarTransforms.calibrateFromEyeHeight(). eyeHeight = " + eyeHeight);

        const m: AvatarMeasurements = AvatarMeasurements.DeriveFromEyeHeight(eyeHeight);

        const root = this.nodes.get(TransformIndex.ROOT)!;
        const head = this.nodes.get(TransformIndex.HEAD)!;
        const leftShoulder = this.nodes.get(TransformIndex.LEFT_SHOULDER)!;
        const leftElbow = this.nodes.get(TransformIndex.LEFT_ELBOW)!;
        const leftWrist = this.nodes.get(TransformIndex.LEFT_WRIST)!;
        const rightShoulder = this.nodes.get(TransformIndex.RIGHT_SHOULDER)!;
        const rightElbow = this.nodes.get(TransformIndex.RIGHT_ELBOW)!;
        const rightWrist = this.nodes.get(TransformIndex.RIGHT_WRIST)!;

        root.position = new Vector3(root.position.x, m.shoulderHeight, root.position.z);
        head.position = new Vector3(0, m.shoulderToEyeOffset, 0);

        leftShoulder.position = new Vector3(m.leftShoulderOffset, 0, 0);
        leftElbow.position = new Vector3(0, m.upperArmLength, 0);
        leftWrist.position = new Vector3(0, m.foreArmLength, 0);

        rightShoulder.position = new Vector3(m.rightShoulderOffset, 0, 0);
        rightElbow.position = new Vector3(0, m.upperArmLength, 0);
        rightWrist.position = new Vector3(0, m.foreArmLength, 0);

        // leftShoulder.position = new Vector3(m.leftShoulderOffset, 0, 0);
        // leftElbow.position = new Vector3(-m.upperArmLength, 0, 0);
        // leftWrist.position = new Vector3(-m.foreArmLength, 0, 0);
        //
        // rightShoulder.position = new Vector3(m.rightShoulderOffset, 0, 0);
        // rightElbow.position = new Vector3(m.upperArmLength, 0, 0);
        // rightWrist.position = new Vector3(m.foreArmLength, 0, 0);

        this.mostRecentMeasurements = m;
    }

    setArmLengthsFromArmspan(armSpan: number): void
    {
        console.log("AvatarTransforms.setArmLengthsFromArmspan(). armSpan = " + armSpan);

        const upperArmLength = 0.2015 * armSpan;
        const lowerArmLength = 0.1582 * armSpan;

        const leftElbow = this.nodes.get(TransformIndex.LEFT_ELBOW)!;
        const leftWrist = this.nodes.get(TransformIndex.LEFT_WRIST)!;
        const rightElbow = this.nodes.get(TransformIndex.RIGHT_ELBOW)!;
        const rightWrist = this.nodes.get(TransformIndex.RIGHT_WRIST)!;

        leftElbow.position = new Vector3(upperArmLength, 0, 0);
        leftWrist.position = new Vector3(lowerArmLength, 0, 0);

        rightElbow.position = new Vector3(upperArmLength, 0, 0);
        rightWrist.position = new Vector3(lowerArmLength, 0, 0);
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
        if (this.mostRecentMeasurements)
        {
            return this.mostRecentMeasurements.height;
        }
        else
        {
            return DEFAULT_HEIGHT;
        }
    }

}
