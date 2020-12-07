import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Color3, Vector3 } from "@babylonjs/core/Maths/math";
import { MeshBuilder } from  "@babylonjs/core/Meshes/meshBuilder";
import { MirrorTexture } from "@babylonjs/core/Materials/Textures/mirrorTexture";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

// A dynamic reflective mirror mesh.
export class Mirror
{
    private texture: MirrorTexture;
    private material: StandardMaterial;
    private mesh: AbstractMesh;

    // Constructs a new Mirror instance.
    public constructor(name: string, position: Vector3, rotation: Vector3, scaling: Vector3, width: number, height: number, resolution: number, scene: Scene)
    {
        // Create the mirror mesh.
        this.mesh = MeshBuilder.CreatePlane(name + "_mirrorPlane", {width: width, height: height}, scene);
        this.mesh.position = position;
        this.mesh.rotation = rotation;

        // Compute the reflection normal.
        this.mesh.computeWorldMatrix(true);
        let worldMatrix = this.mesh.getWorldMatrix();
        let vertexData = this.mesh.getVerticesData("normal");
        let normal = new Vector3(vertexData![0], vertexData![1], vertexData![2]);
        normal = Vector3.TransformNormal(normal, worldMatrix).scale(-1.0);

        // Create the mirror texture.
        this.texture = new MirrorTexture(name + "_mirrorTexture", resolution, scene, true);
        this.texture.mirrorPlane = Plane.FromPositionAndNormal(position, normal);
        this.texture.level = 1;
        this.texture.renderList = [];

        // Create the mirror material.
        this.material = new StandardMaterial(name + "_mirrorMaterial", scene);
        this.material.reflectionTexture = this.texture;
        this.material.diffuseColor = new Color3(0, 0, 0);

        // Apply the mirror material to the mesh.
        this.mesh.material = this.material;
    }

    // Adds a mesh to be reflected in this mirror.
    public render(mesh: AbstractMesh) : void
    {
        this.texture.renderList!.push(mesh);
    }
}
