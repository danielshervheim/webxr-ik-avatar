/* CSCI 5619 Final Project, Fall 2020
 * Author: Alexander Gullickson
 * Author: Daniel Shervheim
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

// Babylon imports.
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture"
import { BoneIKController } from "@babylonjs/core/Bones/boneIKController"
import { Logger } from "@babylonjs/core/Misc/logger";
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshAssetTask, SmartArray } from "@babylonjs/core";
import { MeshBuilder } from  "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { WebXRControllerComponent } from "@babylonjs/core/XR/motionController/webXRControllerComponent"
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";

// Side effects.
import { bonesDeclaration } from "@babylonjs/core/Shaders/ShadersInclude/bonesDeclaration";

// Unused imports.
// import { Angle, Color3, Quaternion, Space, Vector3 } from "@babylonjs/core/Maths/math";
// import { AssetsManager, BoneAxesViewer, DebugLayer, MeshAssetTask, SmartArray } from "@babylonjs/core";
// import { Engine } from "@babylonjs/core/Engines/engine";
// import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
// import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
// import { MirrorTexture } from "@babylonjs/core/Materials/Textures/mirrorTexture"
// import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial"
// import { Plane } from "@babylonjs/core/Maths/math.plane"
// import { StandardMaterial} from "@babylonjs/core/Materials/standardMaterial";
// import { Texture } from "@babylonjs/core/Materials/Textures/texture"
// import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";

enum CalibrationMode
{
    startCal,
    height,     /* Straight Up      */
    armSpan,    /* T-Pose           */
    shoulderTouch,    /* Touch Shoulders  */
    finish,
    hide
}

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
    private scene: Scene;

    private calibrationAvatarTask: MeshAssetTask | null;
    private userAvatarTask: MeshAssetTask | null;

    private xrCamera: WebXRCamera | null;
    private leftController: WebXRInputSource | null;
    private rightController: WebXRInputSource | null;

    private calibrationMode: CalibrationMode;

    private avatarMeasurements: Array<number>;
    private staticText: TextBlock;
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

        this.calibrationAvatarTask = null;
        this.userAvatarTask = null;

        this.xrCamera = null;
        this.leftController = null;
        this.rightController = null;

        this.calibrationMode = CalibrationMode.hide;
        this.avatarMeasurements = [     //Index into based on the Avatar Measurement enum
            AvatarMeasurements.leftArm,
            AvatarMeasurements.leftForeArm,
            AvatarMeasurements.leftUpperArm,
            AvatarMeasurements.rightArm,
            AvatarMeasurements.rightForeArm,
            AvatarMeasurements.rightUpperArm,
            AvatarMeasurements.height,
            AvatarMeasurements.hipHeight];

        this.staticText = new TextBlock();

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

    public registerXRHelper(xrHelper: WebXRDefaultExperience) : void
    {
        this.xrCamera = xrHelper.baseExperience.camera;

        // Assigns the controllers
        xrHelper.input.onControllerAddedObservable.add((inputSource) =>
        {
            if(inputSource.uniqueId.endsWith("left"))
            {
                this.leftController = inputSource;
                if( inputSource.grip != null )
                {
                    this.targetLeft.parent = inputSource.grip;
                    this.targetLeft.setEnabled(false);
                }
            }
            else
            {
                this.rightController = inputSource;
                if( inputSource.grip != null )
                {
                    this.targetRight.parent = inputSource.grip;
                    this.targetRight.setEnabled(false);
                }
            }
        });

        xrHelper.input.onControllerRemovedObservable.add((inputSource) =>
        {
            if(inputSource.uniqueId.endsWith("left"))
            {
                this.targetLeft.parent = null;
                this.targetLeft.setEnabled(true);
            }
            else
            {
                this.targetRight.parent = null;
                this.targetRight.setEnabled(true);
            }
        });

        // Setup a default calibration for the user limb lengths
        this.defaultCal( xrHelper.baseExperience.camera.position.y, xrHelper.baseExperience.camera.position.y);
    }

    public registerCalibrationAvatarFromMeshTask(task : MeshAssetTask ) : void
    {
        this.calibrationAvatarTask = task;

        task.loadedMeshes[0].name     = "calVatar";
        task.loadedMeshes[0].scaling  = new Vector3( 0.1, 0.1, 0.1 );
        task.loadedMeshes[0].position = new Vector3( 0, 0, 2 );
        task.loadedMeshes[0].setEnabled(false);
    }

    public registerUserAvatarFromMeshTask(task : MeshAssetTask ) : void
    {
        this.userAvatarTask = task;

        // Create a task for each asset you want to load
        var poleTarget = MeshBuilder.CreateSphere('poleTarget', {diameter: 0.1}, this.scene);

        task.loadedMeshes[0].name     = "user";
        task.loadedMeshes[0].position = new Vector3( 0, 0, 0 );
        task.loadedMeshes[0].scaling  = new Vector3( 1, 1, 1 );
        task.loadedMeshes[0].setParent(this.headsetPosTrans);

        task.loadedSkeletons[0].name = "userSkel"
        var mesh     = task.loadedMeshes[0];
        var skeleton = task.loadedSkeletons[0];

        poleTarget.position.x       = 0;
        poleTarget.position.y       = 1.3;
        poleTarget.position.z       = -10;
        this.poleTargetTrans.parent = mesh;
        poleTarget.parent           = this.poleTargetTrans;

        // IDX should potential be ForeArm
        // var lBoneIdx = skeleton.getBoneIndexByName("LeftForeArm");
        // var rBoneIdx = skeleton.getBoneIndexByName("RightForeArm");
        // Logger.Log("Hands at " + lBoneIdx + " and " + rBoneIdx)
        // var ikCtlRight = new BoneIKController(mesh, skeleton.bones[lBoneIdx], {targetMesh:this.targetRight, poleTargetMesh:poleTarget, poleAngle: Math.PI});
        // var ikCtlRight = new BoneIKController(mesh, skeleton.bones[lBoneIdx], {targetMesh:this.targetRight, poleTargetMesh:poleTarget, poleAngle: Math.PI});
        // var ikCtlLeft  = new BoneIKController(mesh, skeleton.bones[rBoneIdx], {targetMesh:this.targetLeft, poleTargetMesh:poleTarget, poleAngle: Math.PI});

        // ikCtlRight.maxAngle = Math.PI * .9;
        // ikCtlLeft.maxAngle  = Math.PI * .9;

        // BoneAxesViewer can show axes of each bone when enablesd
        // var bone1AxesViewer = new BoneAxesViewer(this.scene, skeleton.bones[rBoneIdx], <Mesh>mesh);
        // var bone2AxesViewer = new BoneAxesViewer(this.scene, skeleton.bones[lBoneIdx], <Mesh>mesh);

        // register event to update ik model before every frame
        // GLB models needs the transform nodes updated in addition to the skeleton
        this.scene.registerBeforeRender(function () {
            // ikCtlRight.update();
            // ikCtlLeft.update();
            // //update Mesh Nodes ONLY NEEDED WITH .GLB files
            // // both arms and forearms
            // var lArm     = skeleton.bones[skeleton.getBoneIndexByName("LeftArm")].getTransformNode();
            // var rArm     = skeleton.bones[skeleton.getBoneIndexByName("RightArm")].getTransformNode();
            // var lForeArm = skeleton.bones[skeleton.getBoneIndexByName("LeftForeArm")].getTransformNode();
            // var rForeArm = skeleton.bones[skeleton.getBoneIndexByName("RightForeArm")].getTransformNode();
            // if( lArm && rArm && lForeArm && rForeArm )
            // {
            //     lArm.position               = skeleton.bones[skeleton.getBoneIndexByName("LeftArm")].position;
            //     lArm.rotationQuaternion     = skeleton.bones[skeleton.getBoneIndexByName("LeftArm")].rotationQuaternion;
            //     rArm.position               = skeleton.bones[skeleton.getBoneIndexByName("RightArm")].position;
            //     rArm.rotationQuaternion     = skeleton.bones[skeleton.getBoneIndexByName("RightArm")].rotationQuaternion;
            //     lForeArm.position           = skeleton.bones[skeleton.getBoneIndexByName("LeftForeArm")].position;
            //     lForeArm.rotationQuaternion = skeleton.bones[skeleton.getBoneIndexByName("LeftForeArm")].rotationQuaternion;
            //     rForeArm.position           = skeleton.bones[skeleton.getBoneIndexByName("RightForeArm")].position;
            //     rForeArm.rotationQuaternion = skeleton.bones[skeleton.getBoneIndexByName("RightForeArm")].rotationQuaternion;
            // }
        });

        task.loadedMeshes[0].rotation = this.bfActual;
    }

    public onAssetsLoaded() : void
    {
        // TODO
        // Assert registerCalibrationAvatarFromMeshTask has been called.
        if (!this.calibrationAvatarTask)
        {
            console.error('IKAvatar.registerCalibrationAvatarFromMeshTask not called.');
            return;
        }

        // Setup the calibration text.
        this.setupCalibrationText();

        // Get the Bone Lengths for the ready player me skeleton
        this.getBoneLengths();
    }

    private setupCalibrationText() : void
    {
        // TODO


        // Setup Calibration Text with this avatar
        // Create a plane for a text block
        var staticTextPlane            = MeshBuilder.CreatePlane("textPlane", {width: 15, height: 5}, this.scene);
            staticTextPlane.position   = new Vector3(0, 27, 0);
            staticTextPlane.rotation   = new Vector3(0, Math.PI, 0);
            staticTextPlane.isPickable = false;
            staticTextPlane.parent     = this.calibrationAvatarTask!.loadedMeshes[0];

        // Create a dynamic texture for the text block
        var staticTextTexture            = AdvancedDynamicTexture.CreateForMesh(staticTextPlane, 1500, 500);
            staticTextTexture.background = "#E3E0F1";

        // Create a static text block
        this.staticText                         = new TextBlock();
        this.staticText.text                    = "Follow These Prompts";
        this.staticText.color                   = "black";
        this.staticText.fontSize                = 62;
        this.staticText.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
        this.staticText.textVerticalAlignment   = TextBlock.VERTICAL_ALIGNMENT_TOP;

        staticTextTexture.addControl(this.staticText);
    }

    // Calibration Procedures

    private defaultCal( height: number, armSpan: number)
    {
        var arm       = (armSpan / 2.0);
        var foreArm   = (arm / 2.0);
        var upperArm  = (arm / 2.0);
        var hipHeight = (height / 2.0);

        this.avatarMeasurements[AvatarMeasurements.leftArm]        = arm;
        this.avatarMeasurements[AvatarMeasurements.leftForeArm ]   = foreArm;
        this.avatarMeasurements[AvatarMeasurements.leftUpperArm ]  = upperArm;
        this.avatarMeasurements[AvatarMeasurements.rightArm]       = arm;
        this.avatarMeasurements[AvatarMeasurements.rightForeArm ]  = foreArm;
        this.avatarMeasurements[AvatarMeasurements.rightUpperArm ] = upperArm;
        this.avatarMeasurements[AvatarMeasurements.height ]        = height;
        this.avatarMeasurements[AvatarMeasurements.hipHeight ]     = hipHeight;
    }

    private recordArmSpan()
    {
        var armSpan   = 0;
        var armLength = 0;
        if( this.rightController?.grip && this.leftController?.grip)
        {
            // This equation could be made more sophisticated by using the headset position and pythagorean theorem
            // if this current calculation is not accurate enough.
            armSpan   = Vector3.Distance(this.rightController.grip?.position, this.leftController.grip?.position);
            armLength = (armSpan / 2);
            this.avatarMeasurements[AvatarMeasurements.leftArm]  = armLength;
            this.avatarMeasurements[AvatarMeasurements.rightArm] = armLength;
        }
    }

    private recordArmBones()
    {
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
    }

    private recordHeight()
    {
        if( this.xrCamera?.realWorldHeight)
        {
            var height = this.xrCamera.realWorldHeight;
            this.avatarMeasurements[AvatarMeasurements.height]    = height;//this.xrCamera.realWorldHeight;
            this.avatarMeasurements[AvatarMeasurements.hipHeight] = ( height / 2 );//(this.xrCamera.realWorldHeight / 2);
            //scale entire user based on their height
            var user = this.scene.getMeshByName("user");

            if( user )
            {
                // Scaling Procedure
                // Default avatar height is 1.725 at the eyes
                // New Scale = realWorld height / 1.725
                var scaling = user.scaling.clone();
                var scaledHeight = this.xrCamera.realWorldHeight / 1.725;
                user.scaling = new Vector3( scaledHeight, scaledHeight, scaledHeight );
                Logger.Log("Scaled user height from " + scaling + " to " + user.scaling );
            }
        }
    }

    public update() : void
    {
        // Polling for controller input
        this.processControllerInput();

        // Polling for user forward direction
        this.processUserForward();

        // Procer users position and head rotation
        this.processUserPosRot();
    }

    // Process event handlers for controller input
    private processControllerInput()
    {
        this.onRightA(this.rightController?.motionController?.getComponent("a-button"));
        this.onRightB(this.rightController?.motionController?.getComponent("b-button"));
    }

    // Toggle for Avatar Animations in Calibration
    private onRightA(component?: WebXRControllerComponent)
    {
        var calVatar = this.scene.getMeshByName("calVatar");
        if( calVatar )
        {
            // Get for later user
            const idleAnim = this.scene.getAnimationGroupByName("Idle");
            // Increment calibration to the next step
            if(component?.changes.pressed?.current)
            {
                if(this.calibrationMode == CalibrationMode.hide)
                {
                    this.calibrationMode = 0;
                }
                else
                {
                    this.calibrationMode += 1;
                }

                switch( this.calibrationMode )
                {

                case CalibrationMode.startCal:
                    // Show Calibration Avatar
                    calVatar.setEnabled(true);

                    // Initial Animation of Calibration Avatar Vibing
                    //  waiting for calibration to begin
                    if( idleAnim )
                    {
                        idleAnim.start(false, 1.0, idleAnim.from, idleAnim.to, true);
                    }
                    // Instruct User to follow the avatar's poses
                    // Instruct User to press A to continue
                    // Instruct User to press B to exit at anytime
                    // Instruct user to use both controllers for correct cal.
                    this.staticText.fontSize = 62;
                    this.staticText.text     = "Calibration Process Initiated:\n" +
                    "I will walk you through the process, just match my\n" +
                    "poses. When the poses are similiar, press the\n" +
                    "a-button to go to the next pose. Press the b-button\n" +
                    "to cancel the calibration process\n" +
                    "When you are ready to start, press the a-button.";
                    break;

                case CalibrationMode.height:

                    // Animate Avatar to standing upright with arms at its side
                    // Need to change this animation to above description
                    if( idleAnim )
                    {
                        idleAnim.stop();
                    }
                    const walkBackAnim = this.scene.getAnimationGroupByName("WalkingBack");
                    if( walkBackAnim )
                    {
                        walkBackAnim.start(false, 1.0, walkBackAnim.from, walkBackAnim.to, true);
                    }

                    // Inform User to press A after matching pose or press b to cancel
                    this.staticText.fontSize = 124;
                    this.staticText.text     = "User Height (1/3)\n Press a when you have\n matched my pose.";
                    break;

                case CalibrationMode.armSpan:
                    // Record Users height/(possibly hip height)
                    this.recordHeight();
                    // Animate Character to first pose
                    // Just used a default animation for now this will need to be changed to the T-Pose
                    // when it is made in Mixamo
                    if( idleAnim )
                    {
                        idleAnim.stop();
                    }
                    // TODO:
                    // Change animation from walking to T-pose
                    const walkAnim = this.scene.getAnimationGroupByName("Walking");
                    if( walkAnim )
                    {
                        walkAnim.start(false, 1.0, walkAnim.from, walkAnim.to, true);
                    }

                    // Inform User to press A after matching pose or press B to cancel calibration
                    // Display on top of calVatar ( T-Pose 2/3 )
                    this.staticText.text = "T-Pose (2/3)\n Press a when you have\n matched my pose.";
                    break;

                case CalibrationMode.shoulderTouch:
                    // Store users armspan based on controller distance apart
                    this.recordArmSpan();

                    // Stop idle animation if it was still going
                    if( idleAnim )
                    {
                        idleAnim.stop();
                    }
                    // Update Calibration avatar to the next pose (Hands on shoulders)
                    // Need to change this animation from samba to ^^^^
                    const sambaAnim = this.scene.getAnimationGroupByName("Samba");
                    if( sambaAnim )
                    {
                        sambaAnim.start(false, 1.0, sambaAnim.from, sambaAnim.to, true);
                    }

                    // Inform User to press A after matching pose or press be to cancel (below calVatar)
                    this.staticText.text = "Touch your Shoulders (2/3)\n Press a when you have\n matched my pose.";
                    break;

                case CalibrationMode.finish:
                    // Store arm bone lengths from prev poses
                    this.recordArmBones();

                    // Inform Calibration Complete
                    this.staticText.text = "Calibration completed\nsuccesfully.\n Press a to escape."
                    // Possibly animation complete dance by calVatar
                    const completeAnim = this.scene.getAnimationGroupByName("Samba")
                    if( completeAnim )
                    {
                        completeAnim.start(false, 1.3, completeAnim.from, completeAnim.to, true);
                    }
                    break;

                case CalibrationMode.hide:
                    // Hide calVatar
                    calVatar.setEnabled(false);
                    break;

                default:
                    /* Only Reached an error conditions */
                    this.calibrationMode = CalibrationMode.hide;
                    calVatar.setEnabled(false);
                    break;
                }
            }
        }
    }
    // Toggle to cancel avatar calibrations
    private onRightB(component?: WebXRControllerComponent)
    {
        if(component?.changes.pressed?.current)
        {
            if( this.calibrationMode != CalibrationMode.hide )
            {
                this.calibrationMode = CalibrationMode.hide;
                // Hide Calibration Avatar
                var calVatar = this.scene.getMeshByName("calVatar");
                if( calVatar )
                {
                    calVatar.setEnabled(false);
                }
            }
        }
    }

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
        if( this.xrCamera && this.rightController && this.leftController && ( this.cacheCounter < 50 )  )
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
            var userSkel = this.scene.getSkeletonByName("userSkel");
            if( userSkel )
            {
                this.poleTargetTrans.rotation = this.bfActual;
                var mainTrans = userSkel.bones[0].getTransformNode();
                if( mainTrans )
                {
                    mainTrans.rotationQuaternion = this.bfActual.toQuaternion();
                }
            }

        }
    }


    // Process User position and head rotation
    private processUserPosRot()
    {
        if( this.xrCamera )
        {
            // Only Update user position if noticeable change not just looking down
            if( Vector3.Distance( this.xrCamera.position, this.headsetPosTrans.position ) > 1.60)
            {
                this.headsetPosTrans.position = this.xrCamera.position.clone();
                this.headsetPosTrans.position.y = 0;
            }
            // update user head rotation
            var userSkel = this.scene.getSkeletonByName("userSkel");
            if( userSkel )
            {
                var rot = this.xrCamera.rotationQuaternion.toEulerAngles();
                // Yaw = z, Pitch = y, Roll = x;
                var headIdx = userSkel.getBoneIndexByName("Head");
                var headTrans = userSkel.bones[headIdx].getTransformNode();
                if( headTrans )
                {
                    headTrans.rotationQuaternion = new Vector3( rot.x, rot.y - this.bfActual.y, rot.z).toQuaternion();
                }
            }
        }
    }


    // Get the User Avatar Bone Lengths
    // This only works for a single readyplayer me full body avatar right now
    private getBoneLengths()
    {
        var userSkel = this.scene.getSkeletonByName("userSkel");
        if( userSkel )
        {
            // Bones Needed
            // Left  Arm, ForeArm, and Hand
            // Right Arm, ForeArm, and Hand
            // Note Ready Player Me inverts left/right because it sets based on looking at face of avatar
            // Get Index of Bones
            var rArmId     = userSkel.getBoneIndexByName("LeftArm");
            var rForeArmId = userSkel.getBoneIndexByName("LeftForeArm");
            var rHandId    = userSkel.getBoneIndexByName("LeftHand");
            var lArmId     = userSkel.getBoneIndexByName("RightArm");
            var lForeArmId = userSkel.getBoneIndexByName("RightForeArm");
            var lHandId    = userSkel.getBoneIndexByName("RightHand");
            var lIndexId   = userSkel.getBoneIndexByName("RightHandIndex1");

            // Determine Lengths of bones
            var rArmLength     = Vector3.Distance( userSkel.bones[rArmId].getAbsolutePosition(), userSkel.bones[rForeArmId].getAbsolutePosition() );
            var rForeArmLength = Vector3.Distance( userSkel.bones[rForeArmId].getAbsolutePosition(), userSkel.bones[rHandId].getAbsolutePosition() );
            var lArmLength     = Vector3.Distance( userSkel.bones[lArmId].getAbsolutePosition(), userSkel.bones[lForeArmId].getAbsolutePosition() );
            var lForeArmLength = Vector3.Distance( userSkel.bones[lForeArmId].getAbsolutePosition(), userSkel.bones[lHandId].getAbsolutePosition() );
            var lIndexLength   = Vector3.Distance( userSkel.bones[lHandId].getAbsolutePosition(), userSkel.bones[lIndexId].getAbsolutePosition() );

            // Store Lengths to Bones
            userSkel.bones[rArmId].length     = rArmLength;
            userSkel.bones[rForeArmId].length = rForeArmLength;
            userSkel.bones[lArmId].length     = lArmLength;
            userSkel.bones[lForeArmId].length = lForeArmLength;
            userSkel.bones[lForeArmId].length = lForeArmLength;
            userSkel.bones[lHandId].length    = lIndexLength;
        }
    }
}
// End of Avatar class.
