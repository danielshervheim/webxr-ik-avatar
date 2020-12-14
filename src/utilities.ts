import { Bone } from "@babylonjs/core/Bones/bone";
import { Matrix, Vector3, Quaternion } from "@babylonjs/core/Maths/math";
import { Node } from "@babylonjs/core/node";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export class Utilities
{
    // Clamps the given value between 0 and 1.
    static Clamp01(v: number): number
    {
        return Math.min(Math.max(v, 0), 1);
    }

    // Constructs a Quaternion rotation from the given forward and up directions.
    static LookRotation(forward: Vector3, up: Vector3) : Quaternion
    {
        let result = Matrix.Zero();
        Matrix.LookAtLHToRef(Vector3.Zero(), forward, new Vector3(0,1,0), result);
        result.invert();
        return Quaternion.FromRotationMatrix(result);
    }

    // Converts the given world space position into the given transforms local space.
    static WorldToLocalPosition(position: Vector3, transform: Node): Vector3
    {
        let worldToLocal = new Matrix();
        transform.getWorldMatrix().invertToRef(worldToLocal);
        return Vector3.TransformCoordinates(position, worldToLocal);
    }

    // Converts the given world space direction into the given transforms local space.
    static WorldToLocalDirection(direction: Vector3, transform: Node): Vector3
    {
        let worldToLocal = new Matrix();
        transform.getWorldMatrix().invertToRef(worldToLocal);
        return Vector3.TransformNormal(direction, worldToLocal);
    }

    // Converts the given transform's local position to world space.
    static LocalToWorldPosition(position: Vector3, transform: Node): Vector3
    {
        return Vector3.TransformCoordinates(position, transform.getWorldMatrix());
    }

    // Converts the given transform's local direction to world space.
    static LocalToWorldDirection(direction: Vector3, transform: Node): Vector3
    {
        return Vector3.TransformNormal(direction, transform.getWorldMatrix());
    }

    // Resets the given transform to its identity.
    static ResetTransform(transform: TransformNode): void
    {
        transform.position = Vector3.Zero();
        transform.rotation = Vector3.Zero();
        transform.scaling = Vector3.One();
    }

    // Returns the world space minimum Y of the bounding box containing each of
    // this transforms children meshes.
    static GetBoundingMinY(transform: TransformNode): number
    {
        let min = [];
        for (let mesh of transform.getChildMeshes())
        {
            min.push(mesh.getBoundingInfo().boundingBox.minimumWorld.y);
        }

        return Math.min(...min);
    }

    // Returns the world space maximum Y of the bounding box containing each of
    // this transforms children meshes.
    static GetBoundingMaxY(transform: TransformNode): number
    {
        let max = [];
        for (let mesh of transform.getChildMeshes())
        {
            max.push(mesh.getBoundingInfo().boundingBox.maximumWorld.y);
        }

        return Math.max(...max);
    }

    // Returns the height in world space of the bounding box containing each of
    // this transforms children meshes.
    static GetBoundingHeight(transform: TransformNode): number
    {
        return Utilities.GetBoundingMaxY(transform) - Utilities.GetBoundingMinY(transform);
    }

    static SetBoneRotationFromTransformNodeRotation(from: TransformNode, to: Bone): void
    {
        if (from.rotationQuaternion != null)
        {
            to.rotationQuaternion = from.rotationQuaternion;
        }
        else
        {
            to.rotation = from.rotation;
        }
    }
}
