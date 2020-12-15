
// IK imports.
import { AvatarTransforms, TransformIndex } from "./avatarTransforms";
import { BoneIndex, SkeletonBones } from "./skeletonBones";
import { CCD, IKSolver } from "./ikSolver";
import { Utilities } from "./utilities";

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

    constructor(scene: Scene, xrExperience: WebXRDefaultExperience)
    {
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

        // TODO: need to scale arms?
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

        // X pressed.
        if (this.leftController?.motionController?.getComponent("x-button").changes.pressed?.current)
        {
        }

        // Y pressed.
        if (this.leftController?.motionController?.getComponent("y-button").changes.pressed?.current)
        {
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
    }

    private calibrate(): void
    {
        this.transforms.calibrateFromEyeHeight(this.xrCamera!.realWorldHeight);
        const dist = Vector3.Distance(
            this.leftController!.pointer.absolutePosition,
            this.rightController!.pointer.absolutePosition
        );

        if (this.avatarRoot)
        {
            const meshHeight = Utilities.GetBoundingHeight(this.avatarRoot);
            const avatarHeight = this.transforms.getHeight();
            const scalingRatio = avatarHeight/(meshHeight);
            if (Math.abs(scalingRatio) < 0.00001)
            {
                const msg: string = "WARNING - IKAvatar.calibrate(). Degenerate scaling ratio. Ignoring.";
                console.error(msg);
            }
            else
            {
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
                const transformIndicies = [
                    TransformIndex.LEFT_SHOULDER,
                    TransformIndex.LEFT_ELBOW,
                    TransformIndex.LEFT_WRIST,
                    TransformIndex.RIGHT_SHOULDER,
                    TransformIndex.RIGHT_ELBOW,
                    TransformIndex.RIGHT_WRIST
                ];
                const boneIndicies = [
                    BoneIndex.LEFT_SHOULDER,
                    BoneIndex.LEFT_ELBOW,
                    BoneIndex.LEFT_WRIST,
                    BoneIndex.RIGHT_SHOULDER,
                    BoneIndex.RIGHT_ELBOW,
                    BoneIndex.RIGHT_WRIST
                ];

                for (let i = 0; i < transformIndicies.length; i++)
                {
                    const transform = this.transforms.getNode(transformIndicies[i]);
                    const bone = this.avatarBones.getBone(boneIndicies[i]);

                    if (transform.rotationQuaternion != null)
                    {
                        bone.setRotationQuaternion(transform.rotationQuaternion!.clone(), Space.LOCAL);
                        // TODO: for some reason this extra rotation is necessary.
                        // I think its something to do w/ the way the mesh is
                        // prepared in blender???
                        if (boneIndicies[i] == BoneIndex.LEFT_SHOULDER || boneIndicies[i] == BoneIndex.RIGHT_SHOULDER)
                        {
                            bone.rotate(Vector3.Right(), Math.PI, Space.LOCAL);
                        }
                    }
                }
            }
        }
    }
}
