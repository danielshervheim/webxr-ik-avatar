/* CSCI 5619 Final Project, Fall 2020
 * Author: Alexander Gullickson
 * Author: Daniel Shervheim
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

import { CalibrationState, CCDIKAvatar } from "./ccdIKAvatar/ccdIKAvatar";
import { Mirror } from "./mirror";
import { SkeletonBones } from "./ccdIKAvatar/skeletonBones";
import { Utilities } from "./utilities";

// Babylon imports.
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { AssetsManager, MeshAssetTask, SmartArray } from "@babylonjs/core";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Color3, Matrix, Quaternion, Space, Vector3 } from "@babylonjs/core/Maths/math";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from  "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";

// Side effects.
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/inspector";

// A basic scene test bed for our IKAvatar class.
export class BasicSceneCCD
{
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;
    private ikAvatar: CCDIKAvatar | null = null;

    constructor()
    {
        // Get the canvas element
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // Generate the BABYLON 3D engine
        this.engine = new Engine(this.canvas, true);

        // Creates a basic Babylon Scene object
        this.scene = new Scene(this.engine);
    }

    start() : void
    {
        // Create the scene and then execute this function afterwards
        this.createScene().then(() =>
        {

            // Register a render loop to repeatedly render the scene
            this.engine.runRenderLoop(() =>
            {
                this.update();
                this.scene.render();
            });

            // Watch for browser/canvas resize events
            window.addEventListener("resize", () =>
            {
                this.engine.resize();
            });
        });
    }

    private async createScene()
    {
        // This creates and positions a first-person camera (non-mesh)
        const camera = new UniversalCamera("camera1", new Vector3(0, 1.6, 0), this.scene);
        camera.fov = 90 * Math.PI / 180;
        camera.minZ = .1;
        camera.maxZ = 100;

        // This attaches the camera to the canvas
        camera.attachControl(this.canvas, true);
        camera.speed = 0.2;

        // Creates the XR experience helper
        const xrHelper = await this.scene.createDefaultXRExperienceAsync({});

        // Disable teleportation and the laser pointer
        xrHelper.teleportation.dispose();
        xrHelper.pointerSelection.dispose();

        const xrCamera = xrHelper.baseExperience.camera;

        this.ikAvatar = new CCDIKAvatar(this.scene, xrHelper);

        // Add cones to visualize.
        let visualizationMeshes: SmartArray<AbstractMesh> = new SmartArray<AbstractMesh>(0);
        for (let avatarNode of this.ikAvatar.getNodes())
        {
            const cone = MeshBuilder.CreateCylinder(avatarNode.name + "_visualizer", {diameterTop: 0.0, diameterBottom: 0.075, height: 0.1}, this.scene);
            cone.setParent(avatarNode);
            cone.position = Vector3.Zero();
            cone.rotation = Vector3.Zero();
            cone.scaling = Vector3.One();
            if (avatarNode.name.endsWith("Shoulder"))
            {
                cone.scaling.scaleInPlace(0.75);
            }
            else if (avatarNode.name.endsWith("Elbow"))
            {
                cone.scaling.scaleInPlace(0.50);
            }
            else if (avatarNode.name.endsWith("Wrist"))
            {
                cone.scaling.scaleInPlace(0.25);
            }
            visualizationMeshes.push(cone);
        }
        const rootForwardIndicator = MeshBuilder.CreateCylinder("root_forward_visualizer", {diameterTop: 0.0, diameterBottom: 0.15, height:0.2}, this.scene);
        rootForwardIndicator.setParent(this.ikAvatar.getNodes()[0]);
        rootForwardIndicator.position = new Vector3(0, -0.2, 0.2);
        rootForwardIndicator.rotation = new Vector3(Math.PI/2.0, 0, 0);
        visualizationMeshes.push(rootForwardIndicator);

        // Creates a default skybox
        const environment = this.scene.createDefaultEnvironment({
            createGround: false,
            createSkybox: true,
            skyboxSize: 50,
            skyboxColor: new Color3(0, 0, 0)
        });

        // Make sure the environment and skybox is not pickable!
        environment!.skybox!.isPickable = false;

        // Create a light to light up the scene.
        let light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.7;

        let ground = MeshBuilder.CreateGround("Ground", {width:10, height: 10 }, this.scene );
            ground.position = new Vector3( 0, 0.001, 0 );
            ground.overlayColor = new Color3( 0.2, 0.2, 0.25 );
            ground.renderOverlay = true;

        let redMaterial = new StandardMaterial("red", this.scene);
            redMaterial.diffuseColor = new Color3(1, 0, 0);

        let sphere = MeshBuilder.CreateSphere("Sphere", {}, this.scene);
            sphere.position = new Vector3( 1, 1.5, -1);
            sphere.material = redMaterial;

        // Create the mirrors.
        let mirrors: SmartArray<Mirror> = new SmartArray<Mirror>(4);

        mirrors.push(new Mirror(
            "mirror_1",
            new Vector3(0, 2.5, 5),
            new Vector3(0, Math.PI/2.0 * 0, 0),
            new Vector3(1, 1, 1),
            5,
            5,
            1024,
            this.scene
        ));

        mirrors.push(new Mirror(
            "mirror_2",
            new Vector3(5, 2.5, 0),
            new Vector3(0, Math.PI/2.0 * 1, 0),
            new Vector3(1, 1, 1),
            5,
            5,
            1024,
            this.scene
        ));

        mirrors.push(new Mirror(
            "mirror_3",
            new Vector3(0, 2.5, -5),
            new Vector3(0, Math.PI/2.0 * 2, 0),
            new Vector3(1, 1, 1),
            5,
            5,
            1024,
            this.scene
        ));

        mirrors.push(new Mirror(
            "mirror_4",
            new Vector3(-5, 2.5, 0),
            new Vector3(0, Math.PI/2.0 * 3, 0),
            new Vector3(1, 1, 1),
            5,
            5,
            1024,
            this.scene
        ));

        // Register the ground and sphere with all mirrors.
        mirrors.forEach((mirror: Mirror) =>
        {
            mirror.render(sphere);
            mirror.render(ground);
            mirror.render(environment!.skybox!);
            mirror.render(environment!.ground!);

            visualizationMeshes.forEach((mesh: AbstractMesh) =>
            {
                mirror.render(mesh);
            });
        });

        const assetsManager = new AssetsManager(this.scene);

        // Load in the guide meshes.
        const textMeshesTask = assetsManager.addMeshTask("loading text meshes", "", "assets/", "textMeshes.glb");
        let guideStartMesh: AbstractMesh | null = null;
        let guideTPoseMesh: AbstractMesh | null = null;
        let guideFinishMesh: AbstractMesh | null = null;
        let howToStartMesh: AbstractMesh | null = null;
        let howToCancelMesh: AbstractMesh | null = null;
        textMeshesTask.onSuccess = (task: MeshAssetTask) =>
        {
            for (let mesh of task.loadedMeshes)
            {
                // Set up mesh-specific behaviour.
                if (mesh.name == "1_start_mesh")
                {
                    guideStartMesh = mesh;
                    this.ikAvatar?.onCalibrationStateChange.add((state: CalibrationState) =>
                    {
                        guideStartMesh?.setEnabled(state == CalibrationState.START);
                    });
                    mesh.setEnabled(false);
                    mesh.scaling.scaleInPlace(0.5);
                    mesh.renderingGroupId = 1;
                }
                else if (mesh.name == "2_tpose_mesh")
                {
                    guideTPoseMesh = mesh;
                    this.ikAvatar?.onCalibrationStateChange.add((state: CalibrationState) =>
                    {
                        guideTPoseMesh?.setEnabled(state == CalibrationState.TPOSE);
                    });
                    mesh.setEnabled(false);
                    mesh.scaling.scaleInPlace(0.5);
                    mesh.renderingGroupId = 1;
                }
                else if (mesh.name == "3_finish_mesh")
                {
                    guideFinishMesh = mesh;
                    this.ikAvatar?.onCalibrationStateChange.add((state: CalibrationState) =>
                    {
                        guideFinishMesh?.setEnabled(state == CalibrationState.FINISH);
                    });
                    mesh.setEnabled(false);
                    mesh.scaling.scaleInPlace(0.5);
                    mesh.renderingGroupId = 1;
                }
                else if (mesh.name == "how_to_start_mesh")
                {
                    howToStartMesh = mesh;
                    this.ikAvatar?.onCalibrationStateChange.add((state: CalibrationState) =>
                    {
                        howToStartMesh?.setEnabled(state == CalibrationState.OFF);
                    });
                    mesh.setEnabled(true);  // Make sure this one IS enabled on start.
                    mesh.renderingGroupId = 1;
                }
                else if (mesh.name == "how_to_cancel_mesh")
                {
                    howToCancelMesh = mesh;
                    this.ikAvatar?.onCalibrationStateChange.add((state: CalibrationState) =>
                    {
                        howToCancelMesh?.setEnabled(state != CalibrationState.OFF);
                    });
                    mesh.setEnabled(false);
                    mesh.renderingGroupId = 1;
                }
            }
        }

        // Load in the guide avatar.
        const guideAvatarTask = assetsManager.addMeshTask("loading guide avatar", "", "assets/avatars/ybot/ybot.babylon", "");
        let guideAvatarRoot: TransformNode | null = null;
        guideAvatarTask.onSuccess = (task: MeshAssetTask) =>
        {
            // Verify exactly 1 skeleton in the guide avatar.
            if (task.loadedSkeletons.length != 1)
            {
                console.error("expected exactly 1 skeleton in the guide avatar.");
            }
            else
            {
                guideAvatarRoot = new TransformNode("guide_avatar_root", this.scene);
                Utilities.ResetTransform(guideAvatarRoot);
                for (let mesh of task.loadedMeshes)
                {
                    // Render the mesh in the mirror.
                    mirrors.forEach((mirror: Mirror) =>
                    {
                        mirror.render(mesh);
                    });

                    // Parent it to the root.
                    mesh.setParent(guideAvatarRoot);
                }

                // Position, rotate, and scale the root.
                guideAvatarRoot.scaling.scaleInPlace(1.0 / Utilities.GetBoundingHeight(guideAvatarRoot) * 1.68);
                guideAvatarRoot.position = new Vector3(0,0,2);
                guideAvatarRoot.rotation = new Vector3(0, Math.PI, 0);

                // Save skeleton and animations.
                const skeleton = task.loadedSkeletons[0]!;
                const idleRange = skeleton.getAnimationRange("YBot_Idle");
                const tPoseRange = skeleton.getAnimationRange("YBot_TPose");
                const celebrateRange = skeleton.getAnimationRange("YBot_Celebrate");

                // Verify that each animation exists and register them with the
                // calibration state callbacks.
                if (!idleRange || !tPoseRange || !celebrateRange)
                {
                    console.error("guide avatar is missing animation ranges.");
                }
                else
                {
                    // Start idling initially.
                    this.scene.beginAnimation(skeleton, idleRange.from+1, idleRange.to, true);

                    this.ikAvatar?.onCalibrationStateChange.add((state: CalibrationState) =>
                    {
                        if (state == CalibrationState.TPOSE)
                        {
                            this.scene.beginAnimation(skeleton, tPoseRange.from+1, tPoseRange.to, true);
                        }
                        else if (state == CalibrationState.FINISH)
                        {
                            this.scene.beginAnimation(skeleton, celebrateRange.from+1, celebrateRange.to, true);
                        }
                        else if (state == CalibrationState.OFF)
                        {
                            this.scene.beginAnimation(skeleton, idleRange.from+1, idleRange.to, true);
                        }
                    });
                }
            }
        }

        // Load in the player avatar.
        /*
        // NOTE: this is commented out because something's messed up w/ the avatar
        // mesh skeleton and its not lining up correctly (especially the left shoulder).
        const playerAvatarTask = assetsManager.addMeshTask("loading avatar", "", "assets/avatars/xbot/xbot.babylon", "");
        playerAvatarTask.onSuccess = (task) =>
        {
            if (task.loadedSkeletons.length != 1)
            {
                console.error("expected exactly 1 skeleton in the user avatar.");
            }
            else
            {
                try
                {
                    const bones: SkeletonBones = new SkeletonBones(task.loadedSkeletons[0],
                        "mixamorig:Neck",
                        "mixamorig:Head",

                        "mixamorig:LeftArm",
                        "mixamorig:LeftForeArm",
                        "mixamorig:LeftHand",

                        "mixamorig:RightArm",
                        "mixamorig:RightForeArm",
                        "mixamorig:RightHand"
                    );

                    const playerAvatarRoot = new TransformNode("player_avatar_root", this.scene);
                    Utilities.ResetTransform(playerAvatarRoot);
                    for (let mesh of task.loadedMeshes)
                    {
                        // Render the mesh in the mirror.
                        mirrors.forEach((mirror: Mirror) =>
                        {
                            mirror.render(mesh);
                        });

                        // Parent it to the root.
                        mesh.setParent(playerAvatarRoot);

                        // Disable rendering in the XR if its a head mesh. This
                        // is to prevent rendering from the headset POV. (It will
                        // still render in the mirrors).
                        if (!mesh.name.endsWith("arms"))
                        {
                            mesh.layerMask = 0x00000000;
                        }

                        // Disable rendering of everything but the arms (from the
                        // players POV) - this is to prevent clipping.
                        if (mesh.name.endsWith("lower"))
                        {
                            mesh.setEnabled(false);
                        }
                    }

                    // Position, rotate, and scale the root.
                    playerAvatarRoot.scaling.scaleInPlace(1.0 / Utilities.GetBoundingHeight(playerAvatarRoot) * 1.68);

                    // Bind it to the IKAvatar controller.
                    this.ikAvatar?.bindSkeletalMesh(playerAvatarRoot, task.loadedSkeletons[0], bones);

                    // Disable the visualization mesh after the first calibration.
                    this.ikAvatar?.onCalibrationStateChange.add((state: CalibrationState) =>
                    {
                        visualizationMeshes.forEach((mesh: AbstractMesh) =>
                        {
                            mesh.setEnabled(false);
                        });
                    });
                }
                catch(e)
                {
                    console.error('failed to parse user avatar skeleton.');
                    console.error(e);
                }
            }
        }
        */

        assetsManager.onFinish = (tasks) =>
        {
            if (guideAvatarRoot)
            {
                if (guideStartMesh)
                {
                    guideStartMesh.setParent(guideAvatarRoot);
                    guideStartMesh.position = Vector3.Up().scale(215);
                    guideStartMesh.rotation = new Vector3(0, 0, Math.PI);
                }
                if (guideTPoseMesh)
                {
                    guideTPoseMesh.setParent(guideAvatarRoot);
                    guideTPoseMesh.position = Vector3.Up().scale(215);
                    guideTPoseMesh.rotation = new Vector3(0, 0, Math.PI);
                }
                if (guideFinishMesh)
                {
                    guideFinishMesh.setParent(guideAvatarRoot);
                    guideFinishMesh.position = Vector3.Up().scale(215);
                    guideFinishMesh.rotation = new Vector3(0, 0, Math.PI);
                }
            }

            if (howToStartMesh)
            {
                howToStartMesh.setParent(null);
                howToStartMesh.position = new Vector3(-4, 1.5, 0);
                howToStartMesh.rotation = new Vector3(0, Math.PI/2.0, Math.PI);
            }
            if (howToCancelMesh)
            {
                howToCancelMesh.setParent(null);
                howToCancelMesh.position = new Vector3(-4, 1.5, 0);
                howToCancelMesh.rotation = new Vector3(0, Math.PI/2.0, Math.PI);
            }
        }
        assetsManager.load();

        this.scene.debugLayer.show();
    }

    private update() : void
    {
        this.ikAvatar?.update(this.engine.getDeltaTime());
    }
}
