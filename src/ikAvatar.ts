
// IK imports.
import { AvatarTransforms, TransformIndex } from "./avatarTransforms";
import { BoneIndex, SkeletonBones } from "./skeletonBones";
import { CCD, IKSolver } from "./ikSolver";
import { Utilities } from "./utilities";
import { XRLogger } from "./xrLogger";

// Babylon imports.
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { Scene } from "@babylonjs/core/scene";
import { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Matrix, Vector3, Space, Quaternion } from "@babylonjs/core/Maths/math";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { WebXRState } from "@babylonjs/core/XR/webXRTypes";



export enum CalibrationGuide
{
    HOW_TO_START,
    HOW_TO_CANCEL,
    START,
    TPOSE,
    FINISH
}


enum CalibrationState
{
    OFF,
    START,
    TPOSE,
    FINISH
}

// temp.

const ROTS = [
    new Vector3(0, 0, 0),
    new Vector3(Math.PI/2.0, 0, 0),
    new Vector3(0, Math.PI/2.0, 0),
    new Vector3(0, 0, Math.PI/2.0),

    new Vector3(-Math.PI/2.0, 0, 0),
    new Vector3(0, -Math.PI/2.0, 0),
    new Vector3(0, 0, -Math.PI/2.0),

    new Vector3(Math.PI, 0, 0),
    new Vector3(0, Math.PI, 0),
    new Vector3(0, 0, Math.PI),

    new Vector3(-Math.PI, 0, 0),
    new Vector3(0, -Math.PI, 0),
    new Vector3(0, 0, -Math.PI),
];

export class IKAvatar
{
    private scene: Scene;
    private solver: IKSolver;

    private xrExperience: WebXRDefaultExperience;
    private xrCamera: WebXRCamera;
    private leftController: WebXRInputSource | null = null;
    private rightController: WebXRInputSource | null = null;

    private transforms: AvatarTransforms;

    private calibrationState: CalibrationState = CalibrationState.OFF;
    private calibrationGuides: Map<CalibrationGuide, AbstractMesh> = new Map<CalibrationGuide, AbstractMesh>();

    private avatarRoot: TransformNode | null = null;
    private avatarSkeleton: Skeleton | null = null;
    private avatarBones: SkeletonBones | null = null;


    // TMP.
    private logger: XRLogger;
    private rotsIndex: number = 0;

    constructor(scene: Scene, xrExperience: WebXRDefaultExperience)
    {
        this.logger = new XRLogger(
            scene,
            new Vector3(1.5, 1.5, 0),
            new Vector3(0, Math.PI/2.0, 0),
            Vector3.One(),
            null
        );

        this.scene = scene;
        this.xrExperience = xrExperience;
        this.xrExperience.input.onControllerAddedObservable.add((inputSource: WebXRInputSource) =>
        {
            if (inputSource.uniqueId.endsWith("left"))
            {
                this.leftController = inputSource;
            }
            else
            {
                this.rightController = inputSource;
            }
        });
        this.xrExperience.input.onControllerRemovedObservable.add((inputSource: WebXRInputSource) =>
        {
            if (inputSource.uniqueId.endsWith("left"))
            {
                this.leftController = null;
            }
            else
            {
                this.rightController = null;
            }
        });
        this.xrCamera = this.xrExperience.baseExperience.camera;
        this.xrExperience.baseExperience.onStateChangedObservable.add((state: WebXRState) =>
        {
            if (state == WebXRState.IN_XR)
            {
                // this.transforms.calibrateFromEyeHeight(this.xrCamera!.position.y);
                this.transforms.calibrateFromEyeHeight(this.xrCamera!.realWorldHeight);
            }
        });
        this.solver = new CCD();
        this.transforms = new AvatarTransforms(this.scene);
        this.transforms.calibrateFromEyeHeight(1.6);
    }

    bindSkeletalMesh(avatarRoot: TransformNode, avatarSkeleton: Skeleton, avatarBones: SkeletonBones): void
    {
        // TODO: validate avatar and skeletal mesh.

        if (this.avatarRoot != null || this.avatarSkeleton != null)
        {
            this.unbindSkeletalMesh();
        }

        this.avatarRoot = avatarRoot;
        this.avatarSkeleton = avatarSkeleton;
        this.avatarBones = avatarBones;
    }

    unbindSkeletalMesh(): void
    {
        // TODO: cleanup here?

        this.avatarRoot = null;
        this.avatarSkeleton = null;
    }

    bindGuideMesh(guide: CalibrationGuide, mesh: AbstractMesh): void
    {
        this.calibrationGuides.set(guide, mesh);
        this.setGuideMeshVisibility();
    }

    getNodes(): Array<TransformNode>
    {
        return this.transforms.getNodes();
    }

    update(dt: number): void
    {
        // Handle input.
        this.pollControllers();

        // Update the root and solve the left and right arm IKs.
        this.updateRoot();
        this.updateIK(dt);

        // Mirror avatarTransforms to skeletal mesh.
        this.mirrorAvatarToSkeleton();
    }





    // Process event handlers for controller input
    private pollControllers()
    {
        // A pressed.
        if (this.rightController?.motionController?.getComponent("a-button").changes.pressed?.current)
        {
            this.advanceCalibration();
        }

        // B pressed.
        if (this.rightController?.motionController?.getComponent("b-button").changes.pressed?.current)
        {
            this.cancelCalibration();
        }
    }

    advanceCalibration(): void
    {
        this.calibrationState = (this.calibrationState+1) % (CalibrationState.FINISH+1);
        this.setGuideMeshVisibility();

        if (this.calibrationState == CalibrationState.FINISH)
        {
            this.calibrate();
        }
    }

    cancelCalibration(): void
    {
        this.calibrationState = CalibrationState.OFF;
        this.setGuideMeshVisibility();

        // TMP.
        this.rotsIndex = (this.rotsIndex+1)%(ROTS.length);
        this.logger.log("rotation = " + ROTS[this.rotsIndex], true);
    }

    private calibrate(): void
    {
        this.transforms.calibrateFromEyeHeight(this.xrCamera!.realWorldHeight);
        const dist = Vector3.Distance(
            this.leftController!.pointer.absolutePosition,
            this.rightController!.pointer.absolutePosition
        );
        this.logger.log("dist = " + dist, false);

        if (this.avatarRoot)
        {
            const meshHeight = Utilities.GetBoundingHeight(this.avatarRoot);
            this.logger.log("mesh height = " + meshHeight, false);

            const avatarHeight = this.transforms.getHeight();
            this.logger.log("avatar height = " + avatarHeight, false);


            const scalingRatio = avatarHeight/(meshHeight);
            if (Math.abs(scalingRatio) < 0.00001)
            {
                const msg: string = "WARNING - IKAvatar.calibrate(). Degenerate scaling ratio. Ignoring.";
                console.error(msg);

                this.logger.log(msg, false);
            }
            else
            {
                this.logger.log("scaling ratio = " + scalingRatio, false);
                this.avatarRoot.scaling.scaleInPlace(scalingRatio);
            }
        }
    }

    private setGuideMeshVisibility(): void
    {
        this.calibrationGuides.get(CalibrationGuide.HOW_TO_START)?.setEnabled(
            this.calibrationState == CalibrationState.OFF
        );
        this.calibrationGuides.get(CalibrationGuide.HOW_TO_CANCEL)?.setEnabled(
            this.calibrationState != CalibrationState.OFF
        );
        this.calibrationGuides.get(CalibrationGuide.START)?.setEnabled(
            this.calibrationState == CalibrationState.START
        );
        this.calibrationGuides.get(CalibrationGuide.TPOSE)?.setEnabled(
            this.calibrationState == CalibrationState.TPOSE
        );
        this.calibrationGuides.get(CalibrationGuide.FINISH)?.setEnabled(
            this.calibrationState == CalibrationState.FINISH
        );
    }



    private updateRoot(): void
    {
        this.updateRootPosition();
        this.updateRootRotation();
    }

    private updateRootPosition(): void
    {
        const root = this.transforms.getNode(TransformIndex.ROOT);
        root.position = new Vector3(
            this.xrCamera.position.x,
            root.position.y,  // TODO: use Y as well?
            this.xrCamera.position.z
        );
    }

    private updateRootRotation(): void
    {
        if (!this.leftController || !this.rightController)
        {
            return;
        }

        // Compute the vector from the left to right controllers in the XZ plane.
        let averageControllerRight = this.rightController.pointer.absolutePosition.subtract(this.leftController.pointer.absolutePosition);
        averageControllerRight.y = 0.0;
        averageControllerRight.normalize();

        // Compute the vector pointing perpendicular to the line formed by
        // the two controllers, in the XZ plane.
        let averageControllerForward = Vector3.Cross(averageControllerRight, Vector3.Up());
        averageControllerForward.y = 0.0;
        averageControllerForward.normalize();

        // Compute the XR camera forward vector in the XZ plane.
        let cameraForward = this.xrCamera.getDirection(Vector3.Forward());
        cameraForward.y = 0.0;
        cameraForward.normalize();

        // Generate quaternion rotations from the two forward vectors.
        const averageControllerRotation = Utilities.LookRotation(averageControllerForward, Vector3.Up());
        const cameraRotation = Utilities.LookRotation(cameraForward, Vector3.Up());

        // Compute the controller positions in view space.
        const lControllerInCameraLocalSpace = Utilities.WorldToLocalPosition(
            this.leftController.pointer.absolutePosition,
            this.xrCamera
        );
        const rControllerInCameraLocalSpace = Utilities.WorldToLocalPosition(
            this.rightController.pointer.absolutePosition,
            this.xrCamera
        );

        // Generate a blend value: 0 the closer the arms are to crossing
        // (or crossed), and 1 the further the arms are from crossing.
        const controllerDelta = rControllerInCameraLocalSpace.x - lControllerInCameraLocalSpace.x;
        const shoulderWidth: number = Vector3.Distance(
            this.transforms.getNode(TransformIndex.LEFT_SHOULDER).absolutePosition,
            this.transforms.getNode(TransformIndex.RIGHT_SHOULDER).absolutePosition
        );
        const blend = Utilities.Clamp01(controllerDelta / shoulderWidth);

        // If the arms are crossed, use the camera rotation. Otherwise,
        // blend towards the average controller rotation.
        this.transforms.getNode(TransformIndex.ROOT).rotationQuaternion = Quaternion.Slerp(cameraRotation, averageControllerRotation, blend);
    }

    private updateIK(dt: number): void
    {
        const damping = dt/1000.0 * 15.0;

        // Solve left arm IK.
        if (this.leftController)
        {
            this.solver.solve(
                this.transforms.getLeftArmChain(),
                this.transforms.getLeftArmLimits(),
                this.leftController.pointer,
                damping
            );
        }

        // Solve right arm IK.
        if (this.rightController)
        {
            this.solver.solve(
                this.transforms.getRightArmChain(),
                this.transforms.getRightArmLimits(),
                this.rightController.pointer,
                damping
            );
        }
    }

    private mirrorAvatarToSkeleton(): void
    {
        if (this.avatarRoot)
        {
            // Set position such that if follows the XZ of the root, and remains at Y=0.
            // TODO: this assumes that the avatar mesh is centered with its feet at (0,0,0).
            const root = this.transforms.getNode(TransformIndex.ROOT);
            this.avatarRoot.position = new Vector3(
                root.position.x,
                0,
                root.position.z
            );

            // Just copy the root rotation as-is.
            this.avatarRoot.rotationQuaternion = this.transforms.getNode(TransformIndex.ROOT).rotationQuaternion;

            // TODO: copy the IK chains.
            if (this.avatarBones)
            {
                const transforms = [
                    this.transforms.getNode(TransformIndex.LEFT_SHOULDER),
                    this.transforms.getNode(TransformIndex.LEFT_ELBOW),
                    this.transforms.getNode(TransformIndex.LEFT_WRIST),
                    this.transforms.getNode(TransformIndex.RIGHT_SHOULDER),
                    this.transforms.getNode(TransformIndex.RIGHT_ELBOW),
                    this.transforms.getNode(TransformIndex.RIGHT_WRIST)
                ];
                const bones = [
                    this.avatarBones.getBone(BoneIndex.LEFT_SHOULDER),
                    this.avatarBones.getBone(BoneIndex.LEFT_ELBOW),
                    this.avatarBones.getBone(BoneIndex.LEFT_WRIST),
                    this.avatarBones.getBone(BoneIndex.RIGHT_SHOULDER),
                    this.avatarBones.getBone(BoneIndex.RIGHT_ELBOW),
                    this.avatarBones.getBone(BoneIndex.RIGHT_WRIST)
                ];

                for (let i in transforms)
                {
                    Utilities.SetBoneRotationFromTransformNodeRotation(
                        transforms[i],
                        bones[i]
                    );
                }


                /*
                const aLeftShoulder = this.transforms.getNode(TransformIndex.LEFT_SHOULDER);
                const aLeftElbow = this.transforms.getNode(TransformIndex.LEFT_ELBOW);
                const aLeftWrist = this.transforms.getNode(TransformIndex.LEFT_WRIST);

                const bLeftShoulder = this.avatarBones.getBone(BoneIndex.LEFT_SHOULDER);
                const bLeftElbow = this.avatarBones.getBone(BoneIndex.LEFT_ELBOW);
                const bLeftWrist = this.avatarBones.getBone(BoneIndex.LEFT_WRIST);

                // aShoulderToElbow = Quaternion.LookRotation
                const x = Utilities.WorldToLocalPosition(aLeftElbow.absolutePosition, bLeftShoulder);
                const y = Utilities.WorldToLocalPosition(aLeftShoulder.absolutePosition, bLeftShoulder);
                bLeftShoulder.rotationQuaternion = Utilities.LookRotation(Vector3.Normalize(x.subtract(y)), Vector3.Up());
                */
            }
        }
    }
}
