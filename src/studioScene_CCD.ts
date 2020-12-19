/* CSCI 5619 Final Project, Fall 2020
 * Author: Alexander Gullickson
 * Author: Daniel Shervheim
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

import { CalibrationState, CCDIKAvatar } from "./ccdIkAvatar/ccdIkAvatar";
import { Mirror } from "./mirror";
import { SkeletonBones } from "./ccdIkAvatar/skeletonBones";
import { Utilities } from "./utilities";

// Babylon imports.
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { AssetsManager, MeshAssetTask, SmartArray } from "@babylonjs/core";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Color3, Matrix, Quaternion, Space, Vector3 } from "@babylonjs/core/Maths/math";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from  "@babylonjs/core/Meshes/meshBuilder";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";

// Side effects.
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/inspector";

// A basic scene test bed for our IKAvatar class.
export class StudioSceneCCD
{
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;
    private ikAvatar: CCDIKAvatar | null = null;

    private lightmapDictionary : { [id: string] : Array<string>; } = {};
    private lightmapTextures : { [id: string] : Texture | null } = {};

    constructor()
    {
        // Get the canvas element
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // Generate the BABYLON 3D engine
        this.engine = new Engine(this.canvas, true);

        // Creates a basic Babylon Scene object
        this.scene = new Scene(this.engine);

        // Setup the lightmap dictionary. Unfortunately this is necessary
        // because GLB does not natively support embedded lightmaps in materials.
        this.lightmapDictionary["bar_lightmap.jpeg"] = [
            "bar",
        ];

        this.lightmapDictionary["wall_lightmap.jpeg"] = [
            "middle_wall",
        ];

        this.lightmapDictionary["windows_lightmap.jpeg"] = [
            "bar_windows",
            "curtains",
        ];

        this.lightmapDictionary["kitchen_lightmap.jpeg"] = [
            "cabinets",
            "sink",
            "countertop",
            "bar_kitchen",
        ];

        this.lightmapDictionary["props_a_lightmap.jpeg"] = [
            "frames_wall",
            "doors_double",
            "door_single",
            "tv_frame",
        ];

        this.lightmapDictionary["walls_lightmap.jpeg"] = [
            "floor_lamp_gray",
            "ceiling",
            "wall_double_doors",
            "wall_entry",
            "wall_kitchen",
            "wall_table",
            "floor",
        ];

        this.lightmapDictionary["props_big_lightmap.jpeg"] = [
            "chair_top",
            "chair_legs",
            "ottoman",
            "rug",
            "couch",
            "console",
            "shelves",
            "table",
            "tv_screen",
        ];
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

        // Creates a default environment.
        const environment = this.scene.createDefaultEnvironment({
            createGround: false,
            createSkybox: true,
            skyboxSize: 50,
            skyboxColor: new Color3(1, 1, 1)
        });

        // Make sure the environment and skybox is not pickable!
        environment!.skybox!.isPickable = false;

        // Create the mirrors.
        let mirrors: SmartArray<Mirror> = new SmartArray<Mirror>(2);

        mirrors.push(new Mirror(
            "mirrorByWall",
            new Vector3(-5.4, 1.5, 3.6),
            new Vector3(0, 270 * ( Math.PI / 180 ), 0),
            new Vector3(1.3, 0.4, 1),
            5,
            5,
            1024,
            this.scene
        ));

        // mirrors.push(new Mirror(
        //     "mirrorByDoor",
        //     new Vector3(3.85, 1, 7.9),
        //     new Vector3(0, 0, 0),
        //     new Vector3(1, 1, 1),
        //     5,
        //     5,
        //     256,
        //     this.scene
        // ));

        // Register the skybox with all mirrors.
        mirrors.forEach((mirror: Mirror)=>
        {
            mirror.render(environment!.skybox!);
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
                    // mesh.renderingGroupId = 1;
                }
                else if (mesh.name == "how_to_cancel_mesh")
                {
                    howToCancelMesh = mesh;
                    this.ikAvatar?.onCalibrationStateChange.add((state: CalibrationState) =>
                    {
                        howToCancelMesh?.setEnabled(state != CalibrationState.OFF);
                    });
                    mesh.setEnabled(false);
                    // mesh.renderingGroupId = 1;
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
                guideAvatarRoot.position = new Vector3(-1.5,0,2);
                guideAvatarRoot.rotation = new Vector3(0, 136.0 * (Math.PI/180.0), 0);

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
                        else
                        {
                            this.scene.beginAnimation(skeleton, idleRange.from+1, idleRange.to, true);
                        }
                    });
                }
            }
        }

        // Load in the player avatar.
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
                    const skeleton = task.loadedSkeletons[0];

                    const bones: SkeletonBones = new SkeletonBones(skeleton,
                        "mixamorig:Neck",
                        "mixamorig:Head",

                        "mixamorig:LeftArm",
                        "mixamorig:LeftForeArm",
                        "mixamorig:LeftHand",

                        "mixamorig:RightArm",
                        "mixamorig:RightForeArm",
                        "mixamorig:RightHand"
                    );

                    // Adjust shoulder compensation.
                    const lShoulderBone = skeleton.bones[skeleton.getBoneIndexByName("mixamorig:LeftShoulder")]
                    lShoulderBone?.rotate(Vector3.Right(), Math.PI);

                    const rightShoulderBone = skeleton.bones[skeleton.getBoneIndexByName("mixamorig:RightShoulder")]
                    rightShoulderBone?.rotate(Vector3.Right(), Math.PI);

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
                        if (mesh.name.endsWith("upper"))
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

                    // Disable the visualization mesh after the first calibration.
                    this.ikAvatar?.onCalibrationStateChange.add((state: CalibrationState) =>
                    {
                        if (state == CalibrationState.FINISH)
                        {
                            visualizationMeshes.forEach((mesh: AbstractMesh) =>
                            {
                                mesh.setEnabled(false);
                            });
                        }
                    });

                    // Bind it to the IKAvatar controller.
                    this.ikAvatar?.bindSkeletalMesh(playerAvatarRoot, task.loadedSkeletons[0], bones);
                }
                catch(e)
                {
                    console.error('failed to parse user avatar skeleton.');
                    console.error(e);
                }
            }
        }

        // Load the world mesh and scale it appropriately.
        const worldTask = assetsManager.addMeshTask("world task", "", "assets/world.glb", "");
        worldTask.onSuccess = (task) =>
        {
            task.loadedMeshes[0].name = "world";
            Utilities.ResetTransform(task.loadedMeshes[0]);

            for (let mesh of task.loadedMeshes)
            {
                // Render each mesh in the mirrors.
                mirrors.forEach((mirror: Mirror)=>
                {
                    mirror.render(mesh);
                });
            }
        }

        // Load in the lightmaps.
        // Load the lightmaps.
        for (let lightmap in this.lightmapDictionary)
        {
            const loadLightmap = assetsManager.addTextureTask("loading lightmap (" + lightmap + ")", 'assets/lightmaps/' + lightmap, false, false);
            loadLightmap.onSuccess = (task)=>
            {
                task.texture.coordinatesIndex = 1;
                this.lightmapTextures[lightmap] = task.texture;
            }
            loadLightmap.onError = (task)=>
            {
                console.error("failed to load lightmap (" + lightmap + ")");
            }
        }

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
                howToStartMesh.position = new Vector3(4.04, 1, 1);
                howToStartMesh.rotation = new Vector3(0, 270.0 * (Math.PI/180.0), Math.PI);
            }
            if (howToCancelMesh)
            {
                howToCancelMesh.setParent(null);
                howToCancelMesh.position = new Vector3(4.04, 1, 1);
                howToCancelMesh.rotation = new Vector3(0, 270.0 * (Math.PI/180.0), Math.PI);
            }

            // Assign the lightmaps to their materials.
            for (let lightmap in this.lightmapDictionary)
            {
                if (this.lightmapTextures[lightmap])
                {
                    for (let materialName of this.lightmapDictionary[lightmap])
                    {
                        let material = this.scene.getMaterialByName(materialName);
                        if (material)
                        {
                            let lightmapTexture: Texture = this.lightmapTextures[lightmap]!;
                            // Set the lightmap
                            (<PBRMaterial>material).lightmapTexture = lightmapTexture;
                            (<PBRMaterial>material).useLightmapAsShadowmap = true;
                        }
                        else
                        {
                            console.error("didn't find material (" + materialName + ")");
                        }
                    }
                }
            }
        }
        assetsManager.load();

        // Set a few post-processing settings to make the environment look better.
        this.scene.imageProcessingConfiguration.exposure = 1.5;
        this.scene.imageProcessingConfiguration.contrast = 1.5;
        this.scene.environmentIntensity = 1.5;

        // this.scene.debugLayer.show();
    }

    private update() : void
    {
        this.ikAvatar?.update(this.engine.getDeltaTime());
    }
}
