
// IK imports.
import { AvatarTransforms, TransformIndex } from "./avatarTransforms";
import { BoneIndex, SkeletonBones } from "./skeletonBones";
import { CCD, IKSolver } from "./ikSolver";
import { Utilities } from "../utilities";

// Babylon imports.
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { KeyboardEventTypes, KeyboardInfo } from "@babylonjs/core/Events/keyboardEvents";
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { Observable } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Matrix, Vector3, Space, Quaternion } from "@babylonjs/core/Maths/math";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { WebXRState } from "@babylonjs/core/XR/webXRTypes";



export enum CalibrationState
{
    OFF,
    START,
    TPOSE,
    FINISH
}

export class CCDIKAvatar
{
    private scene: Scene;
    private solver: IKSolver;

    private xrExperience: WebXRDefaultExperience;
    private xrCamera: WebXRCamera;
    private leftController: WebXRInputSource | null = null;
    private rightController: WebXRInputSource | null = null;

    private transforms: AvatarTransforms;

    private calibrationState: CalibrationState = CalibrationState.OFF;
    onCalibrationStateChange: Observable<CalibrationState> = new Observable<CalibrationState>();

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

        // TMP / debug
        this.scene.onKeyboardObservable.add((kbInfo: KeyboardInfo) =>
        {
            // A key
            if (kbInfo.type == KeyboardEventTypes.KEYUP && kbInfo.event.keyCode == 65)
            {
                this.advanceCalibration();
            }

            // B key
            if (kbInfo.type == KeyboardEventTypes.KEYUP && kbInfo.event.keyCode == 66)
            {
                this.cancelCalibration();
            }
        });
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

        // Hide initially, show after first successful calibration.
        this.avatarRoot.setEnabled(false);
    }

    unbindSkeletalMesh(): void
    {
        // TODO: cleanup here?

        this.avatarRoot = null;
        this.avatarSkeleton = null;
        this.avatarBones = null;
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
        this.updateArms(dt);
        this.updateHead();

        // Mirror avatarTransforms to skeletal mesh.
        this.mirrorAvatarToSkeleton();
    }

    // Process event handlers for controller input
    private pollControllers(): void
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

        if (this.calibrationState == CalibrationState.FINISH)
        {
            this.calibrate();
        }

        this.onCalibrationStateChange.notifyObservers(this.calibrationState);
    }

    cancelCalibration(): void
    {
        this.calibrationState = CalibrationState.OFF;
        this.onCalibrationStateChange.notifyObservers(this.calibrationState);
    }

    private calibrate(): void
    {
        if (this.xrCamera?.realWorldHeight)
        {
            this.transforms.calibrateFromEyeHeight(this.xrCamera.realWorldHeight);
        }

        if (this.avatarRoot)
        {
            const meshHeight = Utilities.GetBoundingHeight(this.avatarRoot);
            const avatarHeight = this.transforms.getHeight();
            const scalingRatio = avatarHeight/(meshHeight);
            if (Math.abs(scalingRatio) < 0.00001)
            {
                console.error("WARNING - IKAvatar.calibrate(). Degenerate scaling ratio. Ignoring.");
            }
            else
            {
                this.avatarRoot.scaling.scaleInPlace(scalingRatio);
            }

            // Show the avatar!
            this.avatarRoot.setEnabled(true);
            console.log('IKAvatar.calibrate(). Scaling avatar and enabling it');

            // TODO: scale mesh arms as well?
        }

        if (this.leftController && this.rightController)
        {
            const armSpan = Vector3.Distance(
                this.leftController.pointer.getAbsolutePosition(),
                this.rightController.pointer.getAbsolutePosition()
            );
            if (Math.abs(armSpan) < 1e-4)
            {
                console.error("WARNING - IKAvatar.calibrate(). Degenerate arm span. Ignoring.");
            }
            else
            {
                this.transforms.setArmLengthsFromArmspan(armSpan);
            }
        }
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
        if (this.leftController?.pointer && this.rightController?.pointer)
        {
            // Compute the vector from the left to right controllers in the XZ plane.
            let averageControllerRight = this.rightController.pointer.getAbsolutePosition().subtract(this.leftController.pointer.getAbsolutePosition());
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
                this.leftController.pointer.getAbsolutePosition(),
                this.xrCamera
            );
            const rControllerInCameraLocalSpace = Utilities.WorldToLocalPosition(
                this.rightController.pointer.getAbsolutePosition(),
                this.xrCamera
            );

            // Generate a blend value: 0 the closer the arms are to crossing
            // (or crossed), and 1 the further the arms are from crossing.
            const controllerDelta = rControllerInCameraLocalSpace.x - lControllerInCameraLocalSpace.x;
            const shoulderWidth: number = Vector3.Distance(
                this.transforms.getNode(TransformIndex.LEFT_SHOULDER).getAbsolutePosition(),
                this.transforms.getNode(TransformIndex.RIGHT_SHOULDER).getAbsolutePosition()
            );
            const blend = Utilities.Clamp01(controllerDelta / shoulderWidth);

            // If the arms are crossed, use the camera rotation. Otherwise,
            // blend towards the average controller rotation.
            this.transforms.getNode(TransformIndex.ROOT).rotationQuaternion = Quaternion.Slerp(cameraRotation, averageControllerRotation, blend);
        }
    }

    private updateArms(dt: number): void
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

    private updateHead(): void
    {
        const neck = this.transforms.getNode(TransformIndex.HEAD);
        // Convert XR camera forward and up into neck space.
        const camForward = Utilities.WorldToLocalDirection(this.xrCamera.getDirection(Vector3.Forward()), neck);
        const camUp = Utilities.WorldToLocalDirection(this.xrCamera.getDirection(Vector3.Up()), neck);
        neck.rotationQuaternion = Utilities.LookRotation(camForward, camUp);
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

            // Copy the IK chains.
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
                    let transform = this.transforms.getNode(transformIndicies[i]);
                    let bone = this.avatarBones.getBone(boneIndicies[i]);

                    if (transform.rotationQuaternion != null)
                    {
                        bone.setRotationQuaternion(transform.rotationQuaternion!.clone(), Space.LOCAL);
                        bone.markAsDirty();
                    }
                }
            }

            // Copy the neck bone.
            if (this.avatarBones)
            {
                const transform = this.transforms.getNode(TransformIndex.HEAD);
                if (transform.rotationQuaternion != null)
                {
                    const bone = this.avatarBones.getBone(BoneIndex.NECK);
                    bone.setRotationQuaternion(transform.rotationQuaternion, Space.LOCAL);
                    bone.markAsDirty();
                }
            }
        }
    }
}
