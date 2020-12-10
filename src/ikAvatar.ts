/* CSCI 5619 Final Project, Fall 2020
 * Author: Alexander Gullickson
 * Author: Daniel Shervheim
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

 // BoneDictionary imports.
 import { BoneDictionary, Side } from "./boneDictionary";

 // CalibrationAnimationDictionary imports.
 import { CalibrationAnimationDictionary } from "./CalibrationAnimationDictionary";

// export them for later use as well in the scene files.
 export { BoneDictionary, Side, CalibrationAnimationDictionary };

// Babylon imports.
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { BoneAxesViewer } from "@babylonjs/core/Debug/boneAxesViewer";
import { BoneIKController } from "@babylonjs/core/Bones/boneIKController";
import { KeyboardEventTypes, KeyboardInfo } from "@babylonjs/core/Events/keyboardEvents";
import { Logger } from "@babylonjs/core/Misc/logger";
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshAssetTask, SmartArray } from "@babylonjs/core";
import { MeshBuilder } from  "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3, Space } from "@babylonjs/core/Maths/math";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { WebXRControllerComponent } from "@babylonjs/core/XR/motionController/webXRControllerComponent"
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";

// Side effects.
import { bonesDeclaration } from "@babylonjs/core/Shaders/ShadersInclude/bonesDeclaration";

const DEBUG: boolean = true;

// Calibration procedure states.
enum CalibrationMode
{
    startCal,
    height,  // Straight up
    armSpan,  // T-Pose
    shoulderTouch,  // Hands-to-shoulders
    finish,
    hide
}

// Avatar measurement types.
enum AvatarMeasurements
{
    leftArm,
    leftForeArm,
    leftUpperArm,

    rightArm,
    rightForeArm,
    rightUpperArm,

    height,
    hipHeight,
    AvatarMeasurementsCount
}


export class IKAvatar
{
    // The scene this IKAvatar is a part of.
    private scene: Scene;

    // Tasks for loading the calibration and user avatars.
    private calibrationAvatarTask: MeshAssetTask | null = null;
    private calibrationAvatarBoneDictionary: BoneDictionary | null = null;
    private calibrationAnimationDictionary: CalibrationAnimationDictionary | null = null;
    private calibrationAvatarRoot: TransformNode | null = null;

    private userAvatarTask: MeshAssetTask | null = null;
    private userAvatarBoneDictionary: BoneDictionary | null = null;
    private userAvatarRoot: TransformNode | null = null;
    private userAvatarInitialScale: Vector3 = Vector3.One();

    // XR related references.
    private xrCamera: WebXRCamera | null = null;
    private leftController: WebXRInputSource | null = null;
    private rightController: WebXRInputSource | null = null;

    // TransformNodes that mirror the above XR references, but always exist.
    // When the XR reference is null, the node is disabled.
    private xrCameraRef: TransformNode;
    private leftControllerRef: TransformNode;
    private rightControllerRef: TransformNode;

    // Calibration references.
    private calibrationMode: CalibrationMode;
    private calibrationPlane : Mesh | null = null;
    private calibrationTextBlock: TextBlock;
    private avatarMeasurements: Array<number>;

    // IK references.
    private targetRight: Mesh;
    private targetLeft: Mesh;

    // Head/Hands position and orientaiton caches
    private hp : SmartArray<Vector3>;
    private lhp: SmartArray<Vector3>;
    private rhp: SmartArray<Vector3>;
    private ho : SmartArray<Vector3>;
    private cacheCounter: number;

    private fV      : Vector3;
    private fP      : Vector3;
    private bfActual: Vector3;

    private headsetPosTrans: TransformNode;
    private poleTargetTrans: TransformNode;

    constructor(scene: Scene)
    {
        this.scene = scene;

        this.xrCameraRef = new TransformNode("xrCameraRef", this.scene);
        this.xrCameraRef.setEnabled(false);

        this.leftControllerRef = new TransformNode("leftControllerRef", this.scene);
        this.leftControllerRef.setEnabled(false);

        this.rightControllerRef = new TransformNode("rightControllerRef", this.scene);
        this.rightControllerRef.setEnabled(false);

        // Set the initial calibration state.
        this.calibrationMode = CalibrationMode.hide;

        // Index into based on the Avatar Measurement enum
        this.avatarMeasurements =
        [
            AvatarMeasurements.leftArm,
            AvatarMeasurements.leftForeArm,
            AvatarMeasurements.leftUpperArm,
            AvatarMeasurements.rightArm,
            AvatarMeasurements.rightForeArm,
            AvatarMeasurements.rightUpperArm,
            AvatarMeasurements.height,
            AvatarMeasurements.hipHeight
        ];

        this.calibrationTextBlock = new TextBlock();

        this.targetRight = MeshBuilder.CreateSphere("Right Target", { diameter: 0.1 }, this.scene);
        this.targetLeft  = MeshBuilder.CreateSphere("Left Target",  { diameter: 0.1 }, this.scene);

        this.hp  = new SmartArray( 50 );
        this.lhp = new SmartArray( 50 );
        this.rhp = new SmartArray( 50 );
        this.ho  = new SmartArray( 50 );
        for( var i = 0; i <  50; i++)
        {
            this.ho.push(Vector3.Zero());
            this.hp.push(Vector3.Zero());
            this.lhp.push(Vector3.Zero());
            this.rhp.push(Vector3.Zero());
        }

        this.cacheCounter = 0;

        this.fV       = Vector3.Zero();
        this.fP       = Vector3.Zero();
        this.bfActual = Vector3.Zero();

        this.headsetPosTrans = new TransformNode("headset position", this.scene );
        this.poleTargetTrans = new TransformNode("pole Target Tran", this.scene );
    }



    // --------------- //
    // SETUP FUNCTIONS //
    // --------------- //

    // Registers the XR experience with this IKAvatar instance.
    public registerXRExperience(xrExperience: WebXRDefaultExperience) : void
    {
        this.xrCamera = xrExperience.baseExperience.camera;

        this.xrCameraRef.setEnabled(true);
        this.xrCameraRef.setParent(this.xrCamera);
        this.xrCameraRef.position = Vector3.Zero();
        this.xrCameraRef.rotation = Vector3.Zero();
        this.xrCameraRef.scaling = Vector3.One();

        // Assign the controllers.
        xrExperience.input.onControllerAddedObservable.add((inputSource) =>
        {
            if (inputSource.uniqueId.endsWith("left"))
            {
                this.leftController = inputSource;
                if (inputSource.grip != null)
                {
                    this.targetLeft.setParent(inputSource.grip);
                    this.targetLeft.setEnabled(false);
                }

                this.leftControllerRef.setEnabled(true);
                this.leftControllerRef.setParent(inputSource!.pointer);
                this.leftControllerRef.position = Vector3.Zero();
                this.leftControllerRef.rotation = Vector3.Zero();
                this.leftControllerRef.scaling = Vector3.One();
            }
            else
            {
                this.rightController = inputSource;
                if (inputSource.grip != null)
                {
                    this.targetRight.setParent(inputSource.grip);
                    this.targetRight.setEnabled(false);
                }

                this.rightControllerRef.setEnabled(true);
                this.rightControllerRef.setParent(inputSource!.pointer);
                this.rightControllerRef.position = Vector3.Zero();
                this.rightControllerRef.rotation = Vector3.Zero();
                this.rightControllerRef.scaling = Vector3.One();
            }
        });

        // Remove the controllers.
        xrExperience.input.onControllerRemovedObservable.add((inputSource) =>
        {
            if (inputSource.uniqueId.endsWith("left"))
            {
                this.targetLeft.setParent(null);
                this.targetLeft.setEnabled(true);

                this.leftControllerRef.setParent(null);
                this.leftControllerRef.setEnabled(false);
            }
            else
            {
                this.targetRight.setParent(null);
                this.targetRight.setEnabled(true);

                this.rightControllerRef.setParent(null);
                this.rightControllerRef.setEnabled(false);
            }
        });
    }

    // Registers the calibration guide avatar with default transform.
    public registerCalibrationAvatarFromMeshTaskWithDefaults(
        task: MeshAssetTask,
        boneDictionary: BoneDictionary,
        animationDictionary: CalibrationAnimationDictionary) : void
    {
        this.registerCalibrationAvatarFromMeshTask(task, boneDictionary, animationDictionary,
            new Vector3(0, 0, 0), new Vector3(0, 0, 0), Vector3.One());
    }

    // Registers the calibration guide avatar with the IKAvatar instance.
    public registerCalibrationAvatarFromMeshTask(
        task : MeshAssetTask,
        boneDictionary: BoneDictionary,
        animationDictionary: CalibrationAnimationDictionary,
        position: Vector3,
        rotation: Vector3,
        scaling: Vector3) : void
    {
        if (DEBUG)
        {
            console.log("DEBUG - registerCalibrationAvatarFromMeshTask()");
            console.log(task);
        }

        if (task.loadedSkeletons.length != 1)
        {
            console.error("IKAvatar.registerCalibrationAvatarFromMeshTask() failed. Expected exactly 1 loaded skeleton in task.");
            return;
        }

        if (!animationDictionary.skeletonContainsAnimations(task.loadedSkeletons[0]))
        {
            console.error("IKAvatar.registerCalibrationAvatarFromMeshTask() failed. The skeleton is missing animation ranges defined in the animation dictionary.");
            return;
        }

        this.calibrationAvatarTask = task;
        this.calibrationAvatarBoneDictionary = boneDictionary;
        this.calibrationAnimationDictionary = animationDictionary;

        // Create a root object and parent all the children to it.
        this.calibrationAvatarRoot = new TransformNode("calibrationAvatarRoot");
        for (let mesh of task.loadedMeshes)
        {
            mesh.setParent(this.calibrationAvatarRoot);
        }

        // Set its position and scale.
        this.calibrationAvatarRoot.position = position;
        this.calibrationAvatarRoot.rotation = rotation;
        this.calibrationAvatarRoot.scaling = scaling;

        // Disable it initially.
        this.calibrationAvatarRoot.setEnabled(false);
    }

    // Registers the user avatar with default transform.
    public registerUserAvatarFromMeshTaskWithDefaults(
        task: MeshAssetTask,
        boneDictionary: BoneDictionary,
        leftArmMeshName: string,
        rightArmMeshName: string
    ) : void
    {
        this.registerUserAvatarFromMeshTask(
            task,
            boneDictionary,
            leftArmMeshName,
            rightArmMeshName,
            new Vector3(0, 0, 5),
            new Vector3(0, -3.1415926536, 0),
            Vector3.One()
        );
    }

    // Registers the user avatar with the IKAvatar instance.
    public registerUserAvatarFromMeshTask(
        task : MeshAssetTask,
        boneDictionary: BoneDictionary,
        leftArmMeshName: string,
        rightArmMeshName: string,
        position: Vector3,
        rotation: Vector3,
        scaling: Vector3
    ) : void
    {
        // Validate loaded mesh and skeleton.

        if (task.loadedSkeletons.length != 1)
        {
            console.error("ERROR - IKAvatar.registerUserAvatarFromMeshTask failed(). Expected exactly 1 loaded skeleton.");
            return;
        }

        const skeleton = task.loadedSkeletons[0];
        if (!boneDictionary.validateSkeleton(skeleton))
        {
            console.error("ERROR - IKAvatar.registerUserAvatarFromMeshTask failed(). Invalid skeleton. Perhaps the bone names in the bone dictionary are wrong?");
            return;
        }

        // Create a root object and parent all the children to it.
        this.userAvatarRoot = new TransformNode("userAvatarRoot");
        for (let mesh of task.loadedMeshes)
        {
            mesh.setParent(this.userAvatarRoot);
        }

        // Set its position and scale.
        this.userAvatarRoot.position = position;
        this.userAvatarRoot.rotation = rotation;
        this.userAvatarInitialScale = scaling;
        this.userAvatarRoot.scaling = this.userAvatarInitialScale;

        // Look for left and right arm meshes.
        const leftArms = this.userAvatarRoot.getChildMeshes(false, (mesh)=>mesh.name == leftArmMeshName);
        const rightArms = this.userAvatarRoot.getChildMeshes(false, (mesh)=>mesh.name == rightArmMeshName);

        if (leftArms.length != 1 || rightArms.length != 1)
        {
            console.error("ERROR - IKAvatar.registerUserAvatarFromMeshTask failed(). Invalid skeleton. Perhaps the bone names in the bone dictionary are wrong?");
            return;
        }
        const leftArmMesh = leftArms[0];
        const rightArmMesh = rightArms[0];

        // Save the task and bone dictionary.
        this.userAvatarTask = task;
        this.userAvatarBoneDictionary = boneDictionary;

        if (DEBUG)
        {
            console.log("DEBUG - registerUserAvatarFromMeshTask()");
            console.log(task);
        }


        // Disable it initially.
        // this.userAvatarRoot.setEnabled(false);

        // TODO: fix this.

        let leftPoleTarget = MeshBuilder.CreateSphere('leftPoleTarget', {diameter: 0.1}, this.scene);
        leftPoleTarget.position.x       = 0;//-.439;
        leftPoleTarget.position.y       = 1.6;// 1.453;
        leftPoleTarget.position.z       = 0;// 1;
        leftPoleTarget.parent           = this.poleTargetTrans;
        let rightPoleTarget = MeshBuilder.CreateSphere('rightPoleTarget', {diameter: 0.1}, this.scene);
        rightPoleTarget.position.x       =  0;//0.439;
        rightPoleTarget.position.y       =  1.6;//1.453;
        rightPoleTarget.position.z       = 0;//-//1;
        rightPoleTarget.parent           = this.poleTargetTrans;

        this.poleTargetTrans.setParent(this.userAvatarRoot);

        const leftArmBone = skeleton.bones[skeleton.getBoneIndexByName(this.userAvatarBoneDictionary.getForeArmName(Side.LEFT))];
        const rightArmBone = skeleton.bones[skeleton.getBoneIndexByName(this.userAvatarBoneDictionary.getForeArmName(Side.RIGHT))];


        const leftIKControl = new BoneIKController(leftArmMesh, leftArmBone, { targetMesh: this.targetLeft, poleTargetMesh: leftPoleTarget, poleAngle: Math.PI });
        const rightIKControl = new BoneIKController(rightArmMesh, rightArmBone, { targetMesh: this.targetRight, poleTargetMesh: rightPoleTarget, poleAngle: 0 /*Math.PI*/ });

        leftIKControl.maxAngle = Math.PI * 0.9;
        rightIKControl.maxAngle  = Math.PI * 0.9;

        const bone1AxesViewer = new BoneAxesViewer(this.scene, leftArmBone, <Mesh>leftArmMesh);
        const bone2AxesViewer = new BoneAxesViewer(this.scene, rightArmBone, <Mesh>rightArmMesh);

        this.scene.registerBeforeRender(()=>
        {
            leftIKControl.update();
            rightIKControl.update();
            bone1AxesViewer.update();
            bone2AxesViewer.update();
        });
    }

    // Completes initialization of the IKAvatar instance.
    public initialize() : void
    {
        if (!this.xrCamera)
        {
            console.error('IKAvatar.xrCamera is null. Perhaps you forgot to call IKAvatar.registerXRExperience() before IKAvatar.initialize()?');
            return;
        }

        if (!this.calibrationAvatarTask || !this.calibrationAvatarBoneDictionary)
        {
            let which: string = !this.calibrationAvatarTask ? "IKAvatar.calibrationAvatarTask" : "IKAvatar.calibrationAvatarBoneDictionary";
            console.error(which + " is null. Perhaps you forgot to call IKAvatar.registerCalibrationAvatarFromMeshTask() before IKAvatar.initialize()?");
            return;
        }

        if (!this.userAvatarTask || !this.userAvatarBoneDictionary)
        {
            let which: string = !this.userAvatarTask ? "IKAvatar.userAvatarTask" : "IKAvatar.userAvatarBoneDictionary";
            console.error(which + " is null. Perhaps you forgot to call IKAvatar.registerUserAvatarFromMeshTask() before IKAvatar.initialize()?");
            return;
        }


        // Setup a default calibration for the user limb lengths.
        // Most humans arm-span is identical to their height.
        this.resetAvatarMeasurements(this.xrCamera.realWorldHeight,  this.xrCamera.realWorldHeight);

        // TODO: expose the options available for GUI positioning to the user somehow.
        this.setupCalibrationUIWithDefaults();

        // TODO: what is this for???
        // this.getBoneLengths();

        if (DEBUG)
        {
            this.scene.onKeyboardObservable.add((kbInfo: KeyboardInfo) =>
            {
                // A key
                if (kbInfo.type == KeyboardEventTypes.KEYUP && kbInfo.event.keyCode == 65)
                {
                    this.advanceCalibrationProcedure();
                }

                // B key
                if (kbInfo.type == KeyboardEventTypes.KEYUP && kbInfo.event.keyCode == 66)
                {
                    this.cancelCalibrationProcedure();
                }
            });
        }
    }

    // Sets up the GUI with a default transform.
    private setupCalibrationUIWithDefaults() : void
    {
        this.setupCalibrationUI(new Vector3(0, 1, 2), new Vector3(0, 0, 0), new Vector3(0.8, 0.4, 1.0), this.calibrationAvatarRoot);
    }

    // Sets up the GUI with a specified transform and parent.
    private setupCalibrationUI(position: Vector3, rotation: Vector3, scaling: Vector3, parent: TransformNode|null) : void
    {
        this.calibrationPlane = MeshBuilder.CreatePlane("guiPlane", {
            width: 1,
            height: 1
        }, this.scene);

        this.calibrationPlane.position = position;
        this.calibrationPlane.rotation = rotation;
        this.calibrationPlane.scaling = scaling;
        this.calibrationPlane.setParent(parent);
        this.calibrationPlane.isPickable = false;

        const RES: number = 2048;
        const ASPECT: number = scaling.x/scaling.y;

        let texture = AdvancedDynamicTexture.CreateForMesh(this.calibrationPlane, RES, RES/ASPECT);
        texture.background = "#000000";

        this.calibrationTextBlock = new TextBlock();
        this.calibrationTextBlock.text = "Follow These Prompts";
        this.calibrationTextBlock.color = "white";
        this.calibrationTextBlock.fontSize = 48;
        this.calibrationTextBlock.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
        this.calibrationTextBlock.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_CENTER;

        texture.addControl(this.calibrationTextBlock);

        // Hide the UI initially.
        this.calibrationPlane.setEnabled(false);
    }

    // Poll for input and user locomotion.
    public update() : void
    {
        // Polling for controller input
        this.processControllerInput();

        // Polling for user forward direction
        this.processUserForward();

        // Procer users position and head rotation
        this.processUserPosRot();
    }



    // --------------------- //
    // MEASUREMENT FUNCTIONS //
    // --------------------- //

    private resetAvatarMeasurements(height: number, armSpan: number) : void
    {
        let arm = (armSpan / 2.0);
        let foreArm = (arm / 2.0);
        let upperArm = (arm / 2.0);
        let hipHeight = (height / 2.0);

        this.avatarMeasurements[AvatarMeasurements.leftArm] = arm;
        this.avatarMeasurements[AvatarMeasurements.leftForeArm ] = foreArm;
        this.avatarMeasurements[AvatarMeasurements.leftUpperArm ] = upperArm;

        this.avatarMeasurements[AvatarMeasurements.rightArm] = arm;
        this.avatarMeasurements[AvatarMeasurements.rightForeArm ] = foreArm;
        this.avatarMeasurements[AvatarMeasurements.rightUpperArm ] = upperArm;

        this.avatarMeasurements[AvatarMeasurements.height ] = height;
        this.avatarMeasurements[AvatarMeasurements.hipHeight ] = hipHeight;
    }

    private recordArmSpan() : void
    {
        if (!this.rightController?.grip || !this.leftController?.grip)
        {
            console.error("IKAvatar.recordArmSpan() failed. Null controller grip(s).");
            return;
        }

        // This equation could be made more sophisticated by using the headset
        // position and pythagorean theorem if this current calculation is not
        // accurate enough.

        let armSpan = Vector3.Distance(
            this.rightController.grip!.getAbsolutePosition(),
            this.leftController.grip!.getAbsolutePosition()
        );

        // TODO: is this necessary?
        /*
        // Multiply by 0.8 to account for the width of the span taken up by
        // the chest, which is 20% of the overall span (on average).
        armSpan *= 0.8;
        */

        let armLength = (armSpan / 2.0);

        this.avatarMeasurements[AvatarMeasurements.leftArm]  = armLength;
        this.avatarMeasurements[AvatarMeasurements.rightArm] = armLength;

        if (DEBUG)
        {
            console.log("DEBUG - IKAvatar.recordArmSpan()");
            console.log("armLength = " + armLength);
        }
    }

    private recordArmBones() : void
    {
        if (!this.rightController?.grip || !this.leftController?.grip)
        {
            console.error("IKAvatar.recordArmBones() failed. Null controller grip(s).");
            return;
        }

        // TODO: this.

        /*
        var upperArmLength = 0;
        var foreArmLength  = 0;
        if( this.rightController?.grip && this.leftController?.grip )
        {
            var user     = this.scene.getMeshByName("user");
            var userSkel = this.scene.getSkeletonByName("userSkel");
            // Only resize if the user avatar exists and its scaling is uniform
            if( userSkel && user && ( !user.scaling.isNonUniform ) )
            {
                // Get Distance Between the hand and the wrist
                var lHandIdx   = userSkel.getBoneIndexByName( "LeftHand" );

                // Note indexes are swapped intentionally
                var rUpperArmIdx = userSkel.getBoneIndexByName( "LeftArm" );
                var lUpperArmIdx = userSkel.getBoneIndexByName( "RightArm" );
                var lForeArmIdx  = userSkel.getBoneIndexByName( "RightForeArm" );
                var lHandIdx     = userSkel.getBoneIndexByName( "RightHand" );

                // Get Transform Nodes to modify
                var rUpperArmTrans = userSkel.bones[rUpperArmIdx].getTransformNode();
                var lUpperArmTrans = userSkel.bones[lUpperArmIdx].getTransformNode();

                // Get Bone Lengths when Scaled at 1
                var rUpperArmLength = userSkel.bones[rUpperArmIdx].length;
                var lUpperArmLength = userSkel.bones[lUpperArmIdx].length;
                var lForeArmLength  = userSkel.bones[lForeArmIdx].length;
                var handLength      = userSkel.bones[lHandIdx].length;

                // Ratio length: hand, forearm upper arm
                var handRatio     = handLength      / ( handLength + lForeArmLength + lUpperArmLength );
                var foreArmRatio  = lForeArmLength  / ( handLength + lForeArmLength + lUpperArmLength );
                var upperArmRatio = lUpperArmLength / ( handLength + lForeArmLength + lUpperArmLength );

                var torsoWidth = Vector3.Distance(this.rightController.grip.position, this.leftController.grip.position);
                // Update Arm Lengths to Account for Torso Width
                this.avatarMeasurements[AvatarMeasurements.rightArm] -= ( torsoWidth / 2 );
                this.avatarMeasurements[AvatarMeasurements.leftArm]  -= ( torsoWidth / 2 );

                // Assume User Arm Proportions are the standard proportions (shoulder2Elbow 45%, elbow2Wrist 55%)
                upperArmLength = ( this.avatarMeasurements[AvatarMeasurements.rightArm] * (upperArmRatio) );
                foreArmLength  = ( this.avatarMeasurements[AvatarMeasurements.rightArm] * (foreArmRatio) );
                handLength     = ( this.avatarMeasurements[AvatarMeasurements.rightArm] * (handRatio) );

                this.avatarMeasurements[AvatarMeasurements.leftUpperArm]  = upperArmLength;
                this.avatarMeasurements[AvatarMeasurements.rightUpperArm] = upperArmLength;
                this.avatarMeasurements[AvatarMeasurements.leftForeArm]   = foreArmLength;
                this.avatarMeasurements[AvatarMeasurements.rightForeArm]  = foreArmLength;

                // Upper Arm Scalings
                var rUpperArmScaled = ( upperArmLength / rUpperArmLength ) / user.scaling.x;
                var lUpperArmScaled = ( upperArmLength / lUpperArmLength ) / user.scaling.x;
                rUpperArmTrans!.scaling = new Vector3( rUpperArmScaled, rUpperArmScaled, rUpperArmScaled );
                lUpperArmTrans!.scaling = new Vector3( lUpperArmScaled, lUpperArmScaled, lUpperArmScaled );

                rUpperArmTrans?.computeWorldMatrix();
                lUpperArmTrans?.computeWorldMatrix();
            }
        }
        */
    }

    private recordHeight() : void
    {
        if (!this.xrCamera)
        {
            console.error("IKAvatar.recordHeight() failed. Null XRCamera.");
            return;
        }

        if (!this.userAvatarRoot)
        {
            console.error("IKAvatar.recordHeight() failed. Null userAvatarRoot.");
            return;
        }

        let eyeHeight = this.xrCameraRef.getAbsolutePosition().y;
        // let eyeHeight = this.xrCamera!.realWorldHeight;
        let height = eyeHeight/0.93;  // eyeHeight is approx. 93% of total height.
        let hipHeight = height*0.57;  // Hip height is approx. 57% of total height.

        this.avatarMeasurements[AvatarMeasurements.height] = height;
        this.avatarMeasurements[AvatarMeasurements.hipHeight] = hipHeight;

        // Measure the avatar meshes current height by computing its Y bounds.
        let minY: number = 100000;
        let maxY: number = -100000;
        for (let mesh of this.userAvatarRoot!.getChildMeshes())
        {
            if (mesh.getBoundingInfo().boundingBox.minimumWorld.y < minY)
            {
                minY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
            }
            if (mesh.getBoundingInfo().boundingBox.maximumWorld.y > maxY)
            {
                maxY = mesh.getBoundingInfo().boundingBox.maximumWorld.y;
            }
        }

        // Compute the ratio that scales from the current avatar height to the
        // users recorded height. Also check that its not 0 (this might happen
        // if the users head is exactly on the floor, so its unlikely. But if it
        // were to happen, then it would zero out the user avatars scale, and we
        // would be unable to recover it, so its critical that it doesn't happen).
        const currentAvatarHeight = maxY - minY;
        const scalingRatio = height/(1.0*currentAvatarHeight);
        if (Math.abs(scalingRatio) < 0.00001)
        {
            console.error("WARNING - IKAvatar.recordHeight(). Degenerate scaling ratio. Ignoring.");
            return;
        }

        if (DEBUG)
        {
            console.log("DEBUG - IKAvatar.recordHeight()");
            console.log("eyeHeight = " + eyeHeight);
            console.log("height = " + height);
            console.log("hipHeight = " + hipHeight);
            console.log("currentAvatarHeight = " + currentAvatarHeight);
            console.log("scalingRatio = " + scalingRatio);
        }

        this.userAvatarRoot.scaling.scaleInPlace(scalingRatio);
    }

    // TODO: what is this for?
    // Get the User Avatar Bone Lengths
    // This only works for a single readyplayer me full body avatar right now
    private getBoneLengths()
    {
        if (!this.userAvatarTask || !this.userAvatarBoneDictionary)
        {
            console.error("IKAvatar.getBoneLengths().");
            return;
        }
        else
        {
            const userSkeleton = this.userAvatarTask!.loadedSkeletons[0];

            const rArmBone     = userSkeleton.bones[userSkeleton.getBoneIndexByName(this.userAvatarBoneDictionary!.getArmName(Side.RIGHT))];
            const rForeArmBone = userSkeleton.bones[userSkeleton.getBoneIndexByName(this.userAvatarBoneDictionary!.getForeArmName(Side.RIGHT))];
            const rHandBone    = userSkeleton.bones[userSkeleton.getBoneIndexByName(this.userAvatarBoneDictionary!.getHandName(Side.RIGHT))];
            const rIndexBone   = userSkeleton.bones[userSkeleton.getBoneIndexByName(this.userAvatarBoneDictionary!.getIndexName(Side.RIGHT))];

            const lArmBone     = userSkeleton.bones[userSkeleton.getBoneIndexByName(this.userAvatarBoneDictionary!.getArmName(Side.LEFT))];
            const lForeArmBone = userSkeleton.bones[userSkeleton.getBoneIndexByName(this.userAvatarBoneDictionary!.getForeArmName(Side.LEFT))];
            const lHandBone    = userSkeleton.bones[userSkeleton.getBoneIndexByName(this.userAvatarBoneDictionary!.getHandName(Side.LEFT))];
            const lIndexBone   = userSkeleton.bones[userSkeleton.getBoneIndexByName(this.userAvatarBoneDictionary!.getIndexName(Side.LEFT))];

            const bones = [rArmBone, rForeArmBone, rHandBone, rIndexBone, lArmBone, lForeArmBone, lHandBone, lIndexBone];
            for (let bone of bones)
            {
                if (!bone)
                {
                    console.error("IKAvatar.getBoneLengths() failed. Perhaps the provided BoneDictionary contains the wrong name?");
                    return;
                }
            }

            const rArmLength     = Vector3.Distance(rArmBone.getAbsolutePosition(),     rForeArmBone.getAbsolutePosition());
            const rForeArmLength = Vector3.Distance(rForeArmBone.getAbsolutePosition(), rHandBone.getAbsolutePosition());
            const rHandLength    = Vector3.Distance(rHandBone.getAbsolutePosition(),    rIndexBone.getAbsolutePosition());

            const lArmLength     = Vector3.Distance(lArmBone.getAbsolutePosition(),     lForeArmBone.getAbsolutePosition());
            const lForeArmLength = Vector3.Distance(lForeArmBone.getAbsolutePosition(), lHandBone.getAbsolutePosition());
            const lHandLength    = Vector3.Distance(lHandBone.getAbsolutePosition(),    lIndexBone.getAbsolutePosition());

            if (DEBUG)
            {
                console.log("DEBUG - IKAvatar.getBoneLengths()");
                console.log('Right Arm Length = ' + rArmLength);
                console.log('Right ForeArm Length = ' + rForeArmLength);
                console.log('Right Hand Length = ' + rHandLength);

                console.log('Left Arm Length = ' + lArmLength);
                console.log('Left ForeArm Length = ' + lForeArmLength);
                console.log('Left Hand Length = ' + lHandLength);
            }

            // Store lengths to bones.
            rArmBone.length = rArmLength;
            rForeArmBone.length = rForeArmLength;
            rHandBone.length = rHandLength;

            lArmBone.length = lArmLength;
            lForeArmBone.length = lForeArmLength;
            lHandBone.length = lHandLength;

            // For verifying that setting the bones also updates the array.
            // console.log(userSkeleton.bones[userSkeleton.getBoneIndexByName(this.userAvatarBoneDictionary!.getArmName(Side.RIGHT))].length - rArmBone.length);
        }
    }



    // --------------- //
    // INPUT FUNCTIONS //
    // --------------- //

    // Process event handlers for controller input
    private processControllerInput()
    {
        this.onRightA(this.rightController?.motionController?.getComponent("a-button"));
        this.onRightB(this.rightController?.motionController?.getComponent("b-button"));
    }

    // Toggle for Avatar Animations in Calibration
    private onRightA(component?: WebXRControllerComponent) : void
    {
        // Increment calibration to the next step
        if(component?.changes.pressed?.current)
        {
            this.advanceCalibrationProcedure();
        }
    }

    // Toggle to cancel avatar calibrations
    private onRightB(component?: WebXRControllerComponent) : void
    {
        if(component?.changes.pressed?.current)
        {
            this.cancelCalibrationProcedure();
        }
    }



    // ---------------------- //
    // CALIBRATION PROCEDURES //
    // ---------------------- //

    private advanceCalibrationProcedure() : void
    {

        if (this.calibrationMode == CalibrationMode.hide)
        {
            this.calibrationMode = 0;
        }
        else
        {
            this.calibrationMode += 1;
        }

        if (this.calibrationMode == CalibrationMode.startCal)
        {
            this.calibrationProcedureStart();
        }
        else if (this.calibrationMode == CalibrationMode.height)
        {
            this.calibrationProcedureRecordHeight();
        }
        else if (this.calibrationMode == CalibrationMode.armSpan)
        {
            this.calibrationProcedureRecordArmSpan();
        }
        else if (this.calibrationMode == CalibrationMode.shoulderTouch)
        {
            this.calibrationProcedureRecordShoulders();
        }
        else if (this.calibrationMode == CalibrationMode.finish)
        {
            this.calibrationProcedureFinish();
        }
        else if (this.calibrationMode == CalibrationMode.hide)
        {
            this.cancelCalibrationProcedure();
        }
    }

    private cancelCalibrationProcedure() : void
    {
        this.calibrationMode = CalibrationMode.hide;
        this.calibrationAvatarRoot?.setEnabled(false);
        this.calibrationPlane?.setEnabled(false);
    }

    private calibrationProcedureStart() : void
    {
        // Enable the calibration avatar and GUI.
        this.calibrationAvatarRoot?.setEnabled(true);
        this.calibrationPlane?.setEnabled(true);

        // Switch to the idle animation.
        {
            const skeleton = this.calibrationAvatarTask!.loadedSkeletons[0];
            if (!skeleton)
            {
                console.error("IKAvatar.calibrationProcedureStart() failed. Null skeleton.");
                return;
            }

            const range = skeleton!.getAnimationRange(this.calibrationAnimationDictionary!.getIdle());
            if (!range)
            {
                console.error("IKAvatar.calibrationProcedureStart() failed. Null range.");
                return;
            }

            this.scene.beginAnimation(skeleton, range.from, range.to, true);
        }

        // Set the instruction text.
        this.calibrationTextBlock.fontSize = 78;
        this.calibrationTextBlock.text =
            "Let's get calibrated!\n\n" +
            "Try and match my pose as closely as possible.\n\n" +

            "When you're ready, press\n" +
            "the A button to get started.\n\n" +

            "You can cancel the calibration\n\n" +
            "procedure by pressing the B button.";
    }

    private calibrationProcedureRecordHeight() : void
    {
        // Keep the idle animation from the previous state.

        // Inform User to press A after matching pose or press b to cancel
        this.calibrationTextBlock.fontSize = 112;
        this.calibrationTextBlock.text =
            "Stand up tall so I can measure\n" +
            "your height.\n\n" +

            "Press A once you've matched\n" +
            "my pose.";
    }

    private calibrationProcedureRecordArmSpan() : void
    {
        // Record the users height from the previous step.
        this.recordHeight();

        // Switch to the T Pose animation.
        {
            const skeleton = this.calibrationAvatarTask!.loadedSkeletons[0];
            if (!skeleton)
            {
                console.error("IKAvatar.calibrationProcedureRecordArmSpan() failed. Null skeleton.");
                return;
            }

            const range = skeleton!.getAnimationRange(this.calibrationAnimationDictionary!.getTPose());
            if (!range)
            {
                console.error("IKAvatar.calibrationProcedureRecordArmSpan() failed. Null range.");
                return;
            }

            // NOTE: TODO: there is a bug in the blender exporter for single-frame animations,
            // so we need to manually set the range as (to, to) rather than (from, to)
            this.scene.beginAnimation(skeleton, range.to, range.to, false);
            // this.scene.beginAnimation(skeleton, range.from, range.to, true);
        }

        // Inform User to press A after matching pose or press B to cancel calibration
        this.calibrationTextBlock.fontSize = 112;
        this.calibrationTextBlock.text =
            "Now stretch your arms out wide\n" +
            "so I can measure your arm span.\n\n" +

            "Press A once you've matched\n" +
            "my pose.";
    }

    private calibrationProcedureRecordShoulders() : void
    {
        // Record the users arm span from the previous step.
        this.recordArmSpan();

        // Switch to the hands-on-shoulders animation.
        {
            const skeleton = this.calibrationAvatarTask!.loadedSkeletons[0];
            if (!skeleton)
            {
                console.error("IKAvatar.calibrationProcedureRecordShoulders() failed. Null skeleton.");
                return;
            }

            const range = skeleton!.getAnimationRange(this.calibrationAnimationDictionary!.getHandsOnShoulders());
            if (!range)
            {
                console.error("IKAvatar.calibrationProcedureRecordShoulders() failed. Null range.");
                return;
            }

            // NOTE: TODO: there is a bug in the blender exporter for single-frame animations,
            // so we need to manually set the range as (to, to) rather than (from, to)
            this.scene.beginAnimation(skeleton, range.to, range.to, false);
            // this.scene.beginAnimation(skeleton, range.from, range.to, true);
        }

        this.calibrationTextBlock.fontSize = 96;
        this.calibrationTextBlock.text =
            "Place your hands on your shoulders\n" +
            "so I can measure your forearm length.\n\n" +

            "Press A once you've matched my pose.";
    }

    private calibrationProcedureFinish() : void
    {
        // Record the users arm bone lengths from the previous step.
        this.recordArmBones();

        // Switch to the finish animation.
        {
            const skeleton = this.calibrationAvatarTask!.loadedSkeletons[0];
            if (!skeleton)
            {
                console.error("IKAvatar.calibrationProcedureFinish() failed. Null skeleton.");
                return;
            }

            const range = skeleton!.getAnimationRange(this.calibrationAnimationDictionary!.getFinish());
            if (!range)
            {
                console.error("IKAvatar.calibrationProcedureFinish() failed. Null range.");
                return;
            }

            this.scene.beginAnimation(skeleton, range.from, range.to, true);
        }

        this.calibrationTextBlock.fontSize = 136;
        this.calibrationTextBlock.text =
            "Thanks! You're good to go.\n\n" +

            "Press A once more to close\n" +
            "this window.";
    }



    // ------------------------- //
    // LOCOMOTION / IK FUNCTIONS //
    // ------------------------- //

    // Useful function to compare two vectors based on cordinates
    // Cleaner Way of writing the Vector3.Distance function
    private vectorCompare( v1: Vector3, v2: Vector3, dev: number ) : boolean
    {
        return ( Vector3.Distance( v1, v2) < dev )
    }

    // Process Users forward direction and rotate if necessary
    private processUserForward()
    {
        // Only process if headset and controllers are in the scene
        if (this.xrCamera && this.rightController && this.leftController && this.cacheCounter < 50 && this.userAvatarTask)
        {
            // Algorithm adapted from Real-time Full-body Motion Reconstruction and Recognition for Off-the-Shelf VR Devices
            // Section 4.3

            // Update Cache of users head and hand positions and orientaitons
            // Get HeadSet forward Direction
            var hf   = this.xrCamera.rotationQuaternion.toEulerAngles();
                hf.x = 0;
                hf.z = 0;

            // Get Headset position
            var hp = this.xrCamera.position;

            // Get Controllers' Position
            var lhp = this.leftController.pointer.position;
            var rhp = this.rightController.pointer.position;
            var down  = new Vector3( 0, -1, 0 ); // this is down Babylon be lefty

            this.ho.data [this.cacheCounter] = hf;
            this.hp.data [this.cacheCounter] = hp;
            this.lhp.data[this.cacheCounter] = lhp;
            this.rhp.data[this.cacheCounter] = rhp;

            this.cacheCounter = ( ( this.cacheCounter + 1 ) % 50 );
            // Iterate over cache for last 50 frames and determine the average
            var hoAvg  = Vector3.Zero();
            var hpAvg  = Vector3.Zero();
            var lhpAvg = Vector3.Zero();
            var rhpAvg = Vector3.Zero();
            for( var i = 0; i < this.ho.length; i++ )
            {
                hoAvg.addInPlace(this.ho.data[i]);
                hpAvg.addInPlace(this.hp.data[i]);
                lhpAvg.addInPlace(this.lhp.data[i]);
                rhpAvg.addInPlace(this.rhp.data[i]);
            }
            hoAvg.scaleInPlace( 1 / this.ho.length );
            hpAvg.scaleInPlace( 1 / this.hp.length );
            lhpAvg.scaleInPlace( 1 / this.lhp.length );
            rhpAvg.scaleInPlace( 1 / this.rhp.length );

            var headsetStable = false;
            var controlStable = false;

            var stabThresh = 0.5;
            if( this.vectorCompare( hoAvg, hf, stabThresh ) && this.vectorCompare( hpAvg, hp, stabThresh ) )
            {
                headsetStable = true;
            }
            else
            {
                headsetStable = false;
            }

            if( this.vectorCompare( lhpAvg, lhp, stabThresh ) && this.vectorCompare( rhpAvg, rhp, stabThresh ) )
            {
                controlStable = true;
            }
            else
            {
                controlStable = false;
            }

            // Passed by Reference values forward view direction and perpendicular
            var v = this.fV;
            var p = this.fP;

            v = hf;
            p = ( p.add( lhpAvg.subtract( rhpAvg ).cross( down ) ).scale( 1 / ( p.add(lhpAvg.subtract( rhp ).cross( down ) ).length() ) ) );
            // Find P as angle from straight out ( 0, 0 , 1)
            p.normalize();
            var rotP = Vector3.Zero();
            var out = new Vector3( 0, 0, 1 );
            rotP.y = Math.acos( Vector3.Dot( out, p ));

            // Add sign to rotP
            if( ( p.cross( out ).y > 0 ) )
            {
                rotP.y *= -1;
            }

            var aCross : number;
            var aLinear: number;

            var hd = ( lhpAvg.subtract( rhpAvg ) );
            var ld = ( lhpAvg.subtract( hpAvg ) );
            var rd = ( rhpAvg.subtract( hpAvg ) );

            aCross  = Math.acos( Vector3.Dot( hd, ld.add(rd) ) / ( hd.length() * ld.add( rd ).length() ) );
            aLinear = Math.acos( Vector3.Dot( hd, ld) / ( hd.length() * ld.length() ) );

            var bfCurrent = this.bfActual;
            var bfLast    = this.bfActual;
            headsetStable = controlStable = true;
            // Assume headset and both controllers are stable
            if( headsetStable && controlStable )
            {
                // aCross ~90 degrees or aLinear ~0 degrees and
                if( ( ( aCross < ( Math.PI / 2 + 0.1) ) && ( aCross > ( Math.PI / 2 - 0.1 ) ) || ( Math.abs( aLinear ) < 0.1 ) ) &&
                    ( this.vectorCompare( rotP, v, 0.398 ) ) )
                {
                    bfCurrent = v;
                }
            }
            // Below Conditions are Currently not used but they maybe in the future
            // still tweaking
            // Assume only Headset is stable
            else if( headsetStable && !controlStable )
            {
                // check diff p, v
                if( this.vectorCompare( rotP, v, 0.398 ) )
                { // similiar values v more reliable than p (stable head)
                    bfCurrent = v;
                }
                else
                {
                    bfCurrent = v.scale(.5).add(rotP.scale(.5));
                }
            }
            // Assume only controllers are stable
            else if( !headsetStable && controlStable )
            { // user likely looking around maintain orientation
                /* Do Nothing bfCurrent=bfLast */
            }
            // Assume headset and both controllers are unstable
            else if( !headsetStable && !controlStable )
            { //No reliable data don't change
                /* Do Nothing bfCurrent=bfLast */
            }

            var blendFactor = 0.1;
            if( (( bfCurrent.y * bfLast.y) < 0) )
            {
                this.bfActual = bfCurrent;
            }
            else
            {
                this.bfActual = ( bfLast.scale( 1 - blendFactor ).add( bfCurrent.scale( blendFactor ) ) );
            }

            this.fV = v;
            this.fP = p;

            //Update user position
            let skeleton = this.userAvatarTask.loadedSkeletons[0];
            if (skeleton)
            {
                this.poleTargetTrans.rotation = this.bfActual;
                let mainSkelBone = skeleton.bones[0];
                if (mainSkelBone)
                {
                    mainSkelBone.setYawPitchRoll( this.bfActual.y , - Math.PI, 0, Space.LOCAL );
                }
            }
        }
    }

    // Process User position and head rotation
    private processUserPosRot()
    {
        if (this.xrCamera && this.userAvatarTask && this.userAvatarBoneDictionary)
        {
            // Only Update user position if noticeable change not just looking down
            if (Vector3.Distance(this.xrCamera.position, this.headsetPosTrans.position) > 1.60)
            {
                this.headsetPosTrans.position = this.xrCamera.position.clone();
                this.headsetPosTrans.position.y = 0;
            }
            // update user head rotation
            let skeleton = this.userAvatarTask.loadedSkeletons[0];
            if (skeleton)
            {
                const rot = this.xrCamera.rotationQuaternion.toEulerAngles();
                const headIdx = skeleton.getBoneIndexByName(this.userAvatarBoneDictionary.getHeadName());
                const headBone = skeleton.bones[headIdx];
                if (headBone)
                {
                    headBone.rotationQuaternion = new Vector3( rot.x, this.bfActual.y - rot.y, rot.z).toQuaternion();
                }
            }
        }
    }
}
// End of IKAvatar class.
