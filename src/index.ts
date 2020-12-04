/* CSCI 5619 Final Project, Fall 2020
 * Author: Alexander Gullickson
 * Author: Daniel Shervheim
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Quaternion, Angle, Space } from "@babylonjs/core/Maths/math";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from  "@babylonjs/core/Meshes/meshBuilder";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { StandardMaterial} from "@babylonjs/core/Materials/standardMaterial";
import { Logger } from "@babylonjs/core/Misc/logger";
import { AssetsManager, BoneAxesViewer, DebugLayer, SmartArray } from "@babylonjs/core";
import { MirrorTexture } from "@babylonjs/core/Materials/Textures/mirrorTexture"
import { Texture } from "@babylonjs/core/Materials/Textures/texture"
import { Plane } from "@babylonjs/core/Maths/math.plane"
import { WebXRControllerComponent } from "@babylonjs/core/XR/motionController/webXRControllerComponent"
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture"
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock"
import { BoneIKController } from "@babylonjs/core/Bones/boneIKController"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

// Side effects
import "@babylonjs/core/Helpers/sceneHelpers";

// Import debug layer
import "@babylonjs/inspector";

const loadStudioScene = true;

enum CalibrationMode
{
    startCal,
    armSpan,
    armBent,
    height,
    finish,
    hide
}

enum AvatarMeasurements
{
    leftArm,
    leftWrist2Elbow,
    leftElbow2Shoulder,

    rightArm,
    rightWrist2Elbow,
    rightElbow2Shoulder,

    height,
    hipHeight,
    AvatarMeasurementsCount
}

/******* Start of the Game class ******/
class Game
{
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;

    private xrCamera: WebXRCamera | null;
    private leftController: WebXRInputSource | null;
    private rightController: WebXRInputSource | null;

    private calibrationMode: CalibrationMode;

    private avatarMeasurements: Array<number>;
    private staticText: TextBlock;
    private targetRight: Mesh;
    private targetLeft: Mesh;

    private lightmapDictionary : { [id: string] : Array<string>; } = {};
    private lightmapTextures : { [id: string] : Texture | null } = {};
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

    constructor()
    {
        // Get the canvas element
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // Generate the BABYLON 3D engine
        this.engine = new Engine(this.canvas, true);

        // Creates a basic Babylon Scene object
        this.scene = new Scene(this.engine);

        // Initialize XR member variables to null
        this.xrCamera = null;
        this.leftController = null;
        this.rightController = null;

        this.calibrationMode = CalibrationMode.hide;
        this.avatarMeasurements = [     //Index into based on the Avatar Measurement enum
            AvatarMeasurements.leftArm,
            AvatarMeasurements.leftWrist2Elbow,
            AvatarMeasurements.leftElbow2Shoulder,
            AvatarMeasurements.rightArm,
            AvatarMeasurements.rightWrist2Elbow,
            AvatarMeasurements.rightElbow2Shoulder,
            AvatarMeasurements.height,
            AvatarMeasurements.hipHeight];

        this.staticText = new TextBlock();

        this.targetRight = MeshBuilder.CreateSphere("Right Target", { diameter: 0.1 }, this.scene);
        this.targetLeft  = MeshBuilder.CreateSphere("Left Target",  { diameter: 0.1 }, this.scene);

        // Setup the lightmap dictionary. Unfortunately this is necessary
        // because GLB does not natively support embedded lightmaps in materials.
        this.lightmapDictionary["bar_lightmap.jpeg"] = [
            // "Material_177",
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

    start() : void
    {
        // Create the scene and then execute this function afterwards
        this.createScene().then(() => {

            // Register a render loop to repeatedly render the scene
            this.engine.runRenderLoop(() => {
                this.update();
                this.scene.render();
            });

            // Watch for browser/canvas resize events
            window.addEventListener("resize", () => {
                this.engine.resize();
            });
        });
    }

    private async createScene()
    {
        // This creates and positions a first-person camera (non-mesh)
        var camera = new UniversalCamera("camera1", new Vector3(0, 1.6, 0), this.scene);
        camera.fov = 90 * Math.PI / 180;
        camera.minZ = .1;
        camera.maxZ = 100;

        // This attaches the camera to the canvas
        camera.attachControl(this.canvas, true);

        // Creates the XR experience helper
        const xrHelper = await this.scene.createDefaultXRExperienceAsync({});

        // Disable teleportation and the laser pointer
        xrHelper.teleportation.dispose();
        xrHelper.pointerSelection.dispose();

        // Assign the xrCamera to a member variable
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

        // Creates a default skybox
        const environment = this.scene.createDefaultEnvironment({
            createGround: true,
            groundSize: 50,
            skyboxSize: 50,
            skyboxColor: new Color3(0, 0, 0)
        });

        // Make sure the environment and skybox is not pickable!
        environment!.ground!.isPickable = false;
        environment!.skybox!.isPickable = false;

        // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
        var light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);

        // Default intensity is 1. Let's dim the light a small amount
        light.intensity = 0.7;

        // The assets manager can be used to load multiple assets
        var assetsManager = new AssetsManager(this.scene);

        // Create a task for each asset you want to load
        var avatarTask       = assetsManager.addMeshTask( "avatar task", "", "assets/HVGirl.glb", "" );    //.addMeshTask("avatar task", "", "assets/world.glb", "");
        avatarTask.onSuccess = (task) => {
            avatarTask.loadedMeshes[0].name     = "hero";
            avatarTask.loadedMeshes[0].scaling  = new Vector3( 0.1, 0.1, 0.1 );
            avatarTask.loadedMeshes[0].position = new Vector3( 0, 0, 2 );
            avatarTask.loadedMeshes[0].setEnabled(false);
        }

        // Create a task for each asset you want to load
        var poleTarget = MeshBuilder.CreateSphere('poleTarget', {diameter: 2.5}, this.scene);

        var userTask       = assetsManager.addMeshTask( "user task", "", "assets/dude.babylon", "" );    //.addMeshTask("avatar task", "", "assets/world.glb", "");
        userTask.onSuccess = (task) => {
            userTask.loadedMeshes[0].name     = "user";
            userTask.loadedMeshes[0].scaling  = new Vector3( 0.025, 0.025, 0.025 );
            userTask.loadedMeshes[0].position = new Vector3( 0, 0, -0.05 );
            userTask.loadedMeshes[0].setParent(this.headsetPosTrans);

            var mesh     = userTask.loadedMeshes[0];
            var skeleton = userTask.loadedSkeletons[0];

            poleTarget.position.x       = 0;
            poleTarget.position.y       = 100;
            poleTarget.position.z       = -50;
            this.poleTargetTrans.parent = mesh;
            poleTarget.parent           = this.poleTargetTrans;

            var ikCtlRight = new BoneIKController(mesh, skeleton.bones[14], {targetMesh:this.targetRight, poleTargetMesh:poleTarget, poleAngle: Math.PI});
            var ikCtlLeft  = new BoneIKController(mesh, skeleton.bones[33], {targetMesh:this.targetLeft, poleTargetMesh:poleTarget, poleAngle: Math.PI});

            ikCtlRight.maxAngle = Math.PI * .9;
            ikCtlLeft.maxAngle  = Math.PI * .9;

            // BoneAxesViewer can show axes of each bone when enablesd
            // var bone1AxesViewer = new BoneAxesViewer(this.scene, skeleton.bones[14], mesh);
            // var bone2AxesViewer = new BoneAxesViewer(this.scene, skeleton.bones[13], mesh);
            this.scene.registerBeforeRender(function () {
                ikCtlRight.update();
                ikCtlLeft.update();
            });

            userTask.loadedMeshes[0].rotation = this.bfActual;
        }

        // Load in the lightmaps.
        for (let lightmap in this.lightmapDictionary)
        {
            let loadLightmap = assetsManager.addTextureTask("loading lightmap (" + lightmap + ")", 'assets/lightmaps/' + lightmap, false, false);
            loadLightmap.onSuccess = (task)=>
            {
                task.texture.coordinatesIndex = 1;
                this.lightmapTextures[lightmap] = task.texture;
            }
            loadLightmap.onError = (task)=>
            {
                console.log("failed to load lightmap (" + lightmap + ")");
            }
        }

        // Setup a default calibration for the user limb lengths
        this.defaultCal( camera.position.y, camera.position.y);

        // Setup Mirror Textures
        var mirrorTexture1 : MirrorTexture;
        var mirrorTexture2 : MirrorTexture;
        var mirrorTexture3 : MirrorTexture;
        var mirrorTexture4 : MirrorTexture;
        if( loadStudioScene )
        {
            // Setup 2 Mirrored Surfaces in the scene
            // Test Object to reflect
            var redMaterial             = new StandardMaterial("red", this.scene);
            redMaterial.diffuseColor    = new Color3(1, 0, 0);

            var sphere = MeshBuilder.CreateSphere("Sphere", {}, this.scene);
            sphere.position = new Vector3( 1, 1.5, -1);//.y = 1.5;
            sphere.material = redMaterial;
            var i : number;
            for( i = 0; i < 2; i++)
            {
                var glass = MeshBuilder.CreatePlane("glass", {width: 5, height: 5}, this.scene);
                switch(i)
                {
                    case 0:
                        glass.position = new Vector3( -2.49, 1.269, -1.037 );
                        glass.scaling  = new Vector3( 0.575, 0.5, 0.1 );
                        glass.rotation = new Vector3( 0, 270 * ( Math.PI / 180 ), 0);
                        break;
                    case 1:
                        glass.position = new Vector3( 0.01, 1.055, 2.378 );
                        glass.scaling  = new Vector3( 0.099, 0.415, 0.002 );
                        glass.rotation = new Vector3( 5.080 * ( Math.PI / 180 ), 0, 0 );
                        break;
                }
                //Ensure working with new values for glass by computing and obtaining its worldMatrix
                glass.computeWorldMatrix(true);
                var glass_worldMatrix = glass.getWorldMatrix();

                //Obtain normals for plane and assign one of them as the normal
                var glass_vertexData = glass.getVerticesData("normal");
                var glassNormal      = new Vector3(glass_vertexData![0], glass_vertexData![1], glass_vertexData![2]);
                //Use worldMatrix to transform normal into its current value
                glassNormal = Vector3.TransformNormal(glassNormal, glass_worldMatrix)

                //Create reflecting surface for mirror surface
                var reflector = Plane.FromPositionAndNormal(glass.position, glassNormal.scale(-1));

                var mirror1Material = new StandardMaterial("mirror", this.scene);
                var mirror2Material = new StandardMaterial("mirror", this.scene);
                switch(i)
                {
                    case 0:
                        Logger.Log("mirror texture 1");
                        //Create the mirror material
                        mirrorTexture1                    = new MirrorTexture("mirror1", 1024, this.scene, true);
                        mirrorTexture1.mirrorPlane        = reflector;
                        mirrorTexture1.renderList         = [sphere];
                        mirrorTexture1.level              = 1;
                        mirror1Material.reflectionTexture = mirrorTexture1;
                        glass.material                    = mirror1Material;
                        break;
                    case 1:
                        Logger.Log("mirror texture 2");
                        //Create the mirror material
                        mirrorTexture2                    = new MirrorTexture("mirror2", 1024, this.scene, true);
                        mirrorTexture2.mirrorPlane        = reflector;
                        mirrorTexture2.renderList         = [sphere];
                        mirrorTexture2.level              = 1;
                        mirror2Material.reflectionTexture = mirrorTexture2;
                        glass.material                    = mirror2Material;
                        break;
                }
            }

            // Create a task for each asset you want to load
            var worldTask       = assetsManager.addMeshTask("world task", "", "assets/world2.glb", "");
            worldTask.onSuccess = (task) => {
                worldTask.loadedMeshes[0].name      = "world";
                worldTask.loadedMeshes[0].position  = new Vector3( 0, 0.001, 0);
                worldTask.loadedMeshes[0].scaling   = new Vector3(1.25, 1.25, 1.25);
            }
        }
        else
        {  // Just 4 Mirrors, a floor, and test sphere
            var ground               = MeshBuilder.CreateGround("Ground", { width:10, height: 10 }, this.scene );
                ground.position      = new Vector3( 0, 0.001, 0 );
                ground.overlayColor  = new Color3( 0.2, 0.2, 0.25 );
                ground.renderOverlay = true;

            var redMaterial              = new StandardMaterial("red", this.scene);
                redMaterial.diffuseColor = new Color3(1, 0, 0);

            var sphere          = MeshBuilder.CreateSphere("Sphere", {}, this.scene);
                sphere.position = new Vector3( 1, 1.5, -1);
                sphere.material = redMaterial;

           //Creation of a glass planes
            for(var i = 0; i < 4; i++) {
                var glass = MeshBuilder.CreatePlane("glass", {width: 5, height: 5}, this.scene);
                switch(i)
                {
                    case 0:
                        glass.position = new Vector3( 0, 2.5, 5);
                        break;
                    case 1:
                        glass.position = new Vector3( 5, 2.5, 0);
                        break;
                    case 2:
                        glass.position = new Vector3( 0, 2.5, -5);
                        break;
                    case 3:
                        glass.position = new Vector3( -5, 2.5, 0);
                        break;
                }
                    glass.rotation = new Vector3(0, i * Math.PI / 2, 0);

                //Ensure working with new values for glass by computing and obtaining its worldMatrix
                glass.computeWorldMatrix(true);
                var glass_worldMatrix = glass.getWorldMatrix();

                //Obtain normals for plane and assign one of them as the normal
                var glass_vertexData = glass.getVerticesData("normal");
                var glassNormal      = new Vector3(glass_vertexData![0], glass_vertexData![1], glass_vertexData![2]);
                //Use worldMatrix to transform normal into its current value
                glassNormal = Vector3.TransformNormal(glassNormal, glass_worldMatrix)

                //Create reflecting surface for mirror surface
                var reflector = Plane.FromPositionAndNormal(glass.position, glassNormal.scale(-1));

                //Create MirrorTexture
                var mirrorText             = new MirrorTexture("mirror", 1024, this.scene, true);
                    mirrorText.mirrorPlane = reflector;
                    mirrorText.level       = 1;
                    mirrorText.renderList  = [sphere, ground];

                //Create the mirror material
                var mirrorMaterial                   = new StandardMaterial("mirror", this.scene);
                    mirrorMaterial.reflectionTexture = mirrorText;
                switch(i)
                {
                    case 0:
                        mirrorTexture1 = mirrorText;
                        break;
                    case 1:
                        mirrorTexture2 = mirrorText;
                        break;
                    case 2:
                        mirrorTexture3 = mirrorText;
                        break;
                    case 3:
                        mirrorTexture4 = mirrorText;
                        break;

                }
                glass.material = mirrorMaterial;
            }
        }
        // This loads all the assets and displays a loading screen
        assetsManager.load();

        // This will execute when all assets are loaded
        assetsManager.onFinish = (tasks) =>
        {
            if( worldTask && loadStudioScene )
            {
                this.scene.transformNodes.forEach((node) =>
                {
                    // Remove Asset Lights from the scene which cause mirror surfaces to be overexposed
                    if(node.name.startsWith("Point") || node.name.startsWith("Sun"))
                    {
                        node.setEnabled(false);
                    }
                })
                worldTask.loadedMeshes.forEach((mesh) =>
                {
                    // Leave in for now as template if loaded asset file needs manipulating
                    // Note this condition will always evaluate true as there are no point or sun meshes
                    // in the scene
                    if( !(mesh.name.startsWith("Point")) && !(mesh.name.startsWith("Sun") ) )
                    {
                        mirrorTexture1.renderList!.push(mesh);
                        mirrorTexture2.renderList!.push(mesh);
                    }
                });
            }
            // Always hit
            if( userTask )
            {
                userTask.loadedMeshes.forEach((mesh) =>
                {
                    if( loadStudioScene )
                    {
                        mirrorTexture1.renderList!.push(mesh);
                        mirrorTexture2.renderList!.push(mesh);
                    }
                    else
                    {
                        mirrorTexture1.renderList!.push(mesh);
                        mirrorTexture2.renderList!.push(mesh);
                        mirrorTexture3.renderList!.push(mesh);
                        mirrorTexture4.renderList!.push(mesh);
                    }
                });
            }
            if( avatarTask )
            {
                avatarTask.loadedMeshes.forEach((mesh) =>
                {
                    if( loadStudioScene )
                    {
                        mirrorTexture1.renderList!.push(mesh);
                        mirrorTexture2.renderList!.push(mesh);
                    }
                    else
                    {
                        mirrorTexture1.renderList!.push(mesh);
                        mirrorTexture2.renderList!.push(mesh);
                        mirrorTexture3.renderList!.push(mesh);
                        mirrorTexture4.renderList!.push(mesh);
                    }
                });
                const idleAnim = this.scene.getAnimationGroupByName("Idle");
                    if( idleAnim )
                    {
                        idleAnim.stop();
                    }

                // Setup Calibration Text with this avatar
                // Create a plane for a text block
                var staticTextPlane            = MeshBuilder.CreatePlane("textPlane", {width: 15, height: 5}, this.scene);
                    staticTextPlane.position   = new Vector3(0, 27, 0);
                    staticTextPlane.rotation   = new Vector3(0, Math.PI, 0);
                    staticTextPlane.isPickable = false;
                    staticTextPlane.parent     = avatarTask.loadedMeshes[0];

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

            // Assign the lightmaps.
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

            // Show the debug layer
            this.scene.debugLayer.show();
        }
    }

    // The main update loop will be executed once per frame before the scene is rendered
    private update() : void
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
        var calVatar = this.scene.getMeshByName("hero");
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

                case CalibrationMode.armSpan:
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
                    // Display on top of calVatar ( T-Pose 1/3 )
                    this.staticText.fontSize = 124;
                    this.staticText.text     = "T-Pose (1/3)\n Press a when you have\n matched my pose.";
                    break;

                case CalibrationMode.armBent:
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
                    this.staticText.text = "Bent Arms (2/3)\n Press a when you have\n matched my pose.";
                    break;

                case CalibrationMode.height:
                    // Store arm bone lengths from prev pose
                    this.recordArmBones();

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
                    this.staticText.text = "User Height (3/3)\n Press a when you have\n matched my pose.";
                    break;

                case CalibrationMode.finish:
                    // Record Users height/(possibly hip height)
                    this.recordHeight();

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
                var calVatar = this.scene.getMeshByName("hero");
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
            var userSkel = this.scene.getSkeletonByName("Skeleton0");
            if( userSkel )
            {
                this.poleTargetTrans.rotation = this.bfActual;
                userSkel.bones[0].setYawPitchRoll( -Math.PI / 2, -(Math.PI / 2), this.bfActual.y, Space.LOCAL );
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
            var userSkel = this.scene.getSkeletonByName("Skeleton0");
            if( userSkel )
            {
                var rot = this.xrCamera.rotationQuaternion.toEulerAngles();
                // Yaw = z, Pitch = y, Roll = x;
                userSkel.bones[7].setYawPitchRoll( rot.z, ( rot.y - this.bfActual.y ), rot.x - ( 11.099 * Math.PI / 180 ), Space.LOCAL);
            }
        }
    }


    // Calibration Procedures
    private defaultCal( height: number, armSpan: number)
    {
        var arm            = (armSpan / 2);
        var wrist2Elbow    = (arm / 2);
        var elbow2Shoulder = (arm / 2);
        var hipHeight      = (height / 2);

        this.avatarMeasurements[AvatarMeasurements.leftArm]              = arm;
        this.avatarMeasurements[AvatarMeasurements.leftWrist2Elbow ]     = wrist2Elbow;
        this.avatarMeasurements[AvatarMeasurements.leftElbow2Shoulder ]  = elbow2Shoulder;
        this.avatarMeasurements[AvatarMeasurements.rightArm]             = arm;
        this.avatarMeasurements[AvatarMeasurements.rightWrist2Elbow ]    = wrist2Elbow;
        this.avatarMeasurements[AvatarMeasurements.rightElbow2Shoulder ] = elbow2Shoulder;
        this.avatarMeasurements[AvatarMeasurements.height ]              = height;
        this.avatarMeasurements[AvatarMeasurements.hipHeight ]           = hipHeight;
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
        var elbow2ShoulderLength = 0;
        var wrist2ElbowLength    = 0;
        if( this.rightController?.grip && this.leftController?.grip )
        {
            var torsoWidth = Vector3.Distance(this.rightController.grip.position, this.leftController.grip.position);

            // Update Arm Lengths to Account for Torso Width
            this.avatarMeasurements[AvatarMeasurements.rightArm] -= ( torsoWidth / 2 );
            this.avatarMeasurements[AvatarMeasurements.leftArm] -= ( torsoWidth / 2 );

            // Assume User Arm Proportions are the standard proportions (shoulder2Elbow 45%, elbow2Wrist 55%)
            elbow2ShoulderLength = ( this.avatarMeasurements[AvatarMeasurements.rightArm] * (.55) );
            wrist2ElbowLength    = ( this.avatarMeasurements[AvatarMeasurements.rightArm] * (.45) );

            this.avatarMeasurements[AvatarMeasurements.leftElbow2Shoulder]  = elbow2ShoulderLength;
            this.avatarMeasurements[AvatarMeasurements.rightElbow2Shoulder] = elbow2ShoulderLength;
            this.avatarMeasurements[AvatarMeasurements.leftWrist2Elbow]     = wrist2ElbowLength;
            this.avatarMeasurements[AvatarMeasurements.rightWrist2Elbow]    = wrist2ElbowLength;
        }
    }
    private recordHeight()
    {
        if( this.xrCamera?.realWorldHeight)
        {
            this.avatarMeasurements[AvatarMeasurements.height]    = this.xrCamera.realWorldHeight;
            this.avatarMeasurements[AvatarMeasurements.hipHeight] = (this.xrCamera.realWorldHeight / 2);
        }
    }
}
/******* End of the Game class ******/

// start the game
var game = new Game();
game.start();
