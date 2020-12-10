import { Engine } from "@babylonjs/core/Engines/engine";
import { Space, Vector3 } from "@babylonjs/core/Maths/math";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export abstract class IKSolver
{
    protected engine: Engine;

    constructor(engine: Engine)
    {
        this.engine = engine;
    }

    // Solves the given IK chain to point it towards the target.
    // @param chain: the joints.
    // @param limits: the joint rotation limits in radians.
    // @param target: the IK goal position in world space.
    abstract solve(chain: Array<TransformNode>, limits: Array<number>, target: Vector3, iterations: number, speed: number): void;
}

// https://zalo.github.io/blog/inverse-kinematics/#ccdik
export class CCD extends IKSolver
{
    solve(chain: Array<TransformNode>, limits: Array<number>, target: Vector3, iterations: number, speed: number): void
    {
        for (let iter = 0; iter < iterations; iter++)
        {
            for (let i = chain.length-1; i >= 0; i--)
            {

                let effector = target;
                if (i < chain.length-1)
                {
                    effector = chain[chain.length-1].absolutePosition;
                }

                const directionToEffector = effector.subtract(chain[i].absolutePosition);

                // const directionToEffector = chain[i].getDirection(Vector3.Forward());
                const directionToTarget = target.subtract(chain[i].absolutePosition);

                const axis = Vector3.Cross(directionToEffector, directionToTarget); axis.normalize();
                const angle = Math.acos(Vector3.Dot(Vector3.Normalize(directionToEffector), Vector3.Normalize(directionToTarget)));

                if (axis.equalsWithEpsilon(Vector3.Zero(), 0.000001))
                {
                    continue;
                }

                const dt = this.engine.getDeltaTime() / 1000.0;
                chain[i].rotate(axis, angle*dt/iterations*speed, Space.WORLD);

                // TODO: incorperate joint limits.
            }
        }
    }
}

// https://www.researchgate.net/publication/257723209_A_Fast_Inverse_Kinematics_Algorithm_for_Joint_Animation
export class TargetTriangle extends IKSolver
{
    solve(chain: Array<TransformNode>, limits: Array<number>, target: Vector3, iterations: number, speed: number): void
    {
        const dt = this.engine.getDeltaTime() / 1000.0;

        for (let iter = 0; iter < iterations; iter++)
        {
            for (let i = 0; i < chain.length-1; i++)
            {
                const effector = chain[chain.length-1].absolutePosition;

                const cur = chain[i];
                const next = chain[i+1];

                const p = cur.absolutePosition;

                const ve = effector.subtract(p); // end effector for ith link
                const vt = target.subtract(p);  // target vector for ith link
                const vr = Vector3.Cross(ve, vt); vr.normalize();
                const a = Vector3.Distance(cur.absolutePosition, next.absolutePosition);  // length of joint we are currently moving
                let b = 0;  // length of the remaining chain
                for (let j = i; j < chain.length-1; j++)
                {
                    b += Vector3.Distance(chain[j].absolutePosition, chain[j+1].absolutePosition);
                }
                const c = vt.length();  // distance from target to current joint
                const theta = Math.acos(Vector3.Dot(Vector3.Normalize(ve), Vector3.Normalize(vt)));

                if (c > a+b)
                {
                    cur.rotate(vr, theta * dt * speed / iterations, Space.WORLD);
                    continue;
                }
                if (c < Math.abs(a-b))
                {
                    cur.rotate(vr, -theta * dt * speed / iterations, Space.WORLD);
                    continue;
                }
                if (a*a + b*b - c*c > 0)
                {
                    let gammaB = Math.acos((a*a+c*c-b*b)/(2*a*c));
                    const gammaC = Math.acos((a*a+b*b-c*c)/(2*a*b));
                    const betaT = Math.PI - gammaC;

                    if (betaT > limits[i])
                    {
                        gammaB -= 10/180.0*Math.PI;
                    }
                    else
                    {
                        gammaB += 10/180.0*Math.PI;
                    }

                    const betaI = theta - gammaB;

                    cur.rotate(vr, betaI * dt * speed / iterations, Space.WORLD);
                    continue;
                }
            }
        }
    }
}

// http://andreasaristidou.com/publications/papers/FABRIK.pdf
// NOTE: i never got this working...
/*
export class FABRIK extends IKSolver
{
    solve(chain: Array<TransformNode>, limits: Array<number>, target: Vector3, iterations: number, speed: number): void
    {

        /*
        let pos = new Array<Vector3>(chain.length);
        for (let i = 0; i < pos.length; i++)
        {
            pos[i] = chain[i].absolutePosition;
        }

        let dist = new Array<number>(chain.length-1);
        let chainDist = 0;
        for (let i = 0; i < dist.length - 1; i++)
        {
            dist[i] = Vector3.Distance(pos[i], pos[i+1]);
            chainDist += dist[i];
        }

        // The distance between root and target
        let rootTargetDist = Vector3.Distance(pos[0], target);

        // Check whether the target is within reach
        if (rootTargetDist > chainDist)
        {
            // Unreachable goal.
            for (let i = 0; i < chain.length - 1; i++)
            {
                // Find the distance ri between the target t and the joint position pi
                const rI = Vector3.Distance(target, pos[i]);
                const lambdaI = dist[i] / rI;

                // Find the new joint positions pi.
                pos[i+1] = pos[i].scale(1.0 - lambdaI).add(target.scale(lambdaI));
            }
        }
        else
        {
            // The target is reachable; thus, set as b the initial position of the joint p1
            const b = pos[0];

            // Check whether the distance between the end effector Pn and the target t is greater than a tolerance.
            let difA = Vector3.Distance(pos[pos.length-1], target);
            const TOL = 1.0;
            while (difA > TOL)
            {
                // STAGE 1: FORWARD REACHING
                // Set the end effector pn as target t
                pos[pos.length-1] = target;
                for (let i = pos.length-1; i >= 0; i--)
                {
                    // Find the distance ri between the new joint position pi+1 and the joint pi
                    let rI = Vector3.Distance(pos[i+1], pos[i]);
                    let lambdaI = dist[i]/rI;

                    // Find the new joint positions pi.
                    pos[i] = pos[i+1].scale(1.0 - lambdaI).add(pos[i].scale(lambdaI));
                }

                // STAGE 2: BACKWARD REACHING
                // Set the root p1 its initial position.
                pos[0] = b;
                for (let i = 0; i < pos.length-1; i++)
                {
                    // Find the distance ri between the new joint position pi+1 and the joint pi
                    let rI = Vector3.Distance(pos[i+1], pos[i]);
                    let lambdaI = dist[i]/rI;

                    // Find the new joint positions pi.
                    pos[i+1] = pos[i].scale(1.0 - lambdaI).add(pos[i+1].scale(lambdaI));
                }
                difA = Vector3.Distance(pos[pos.length-1], target);
            }
        }

        for (let i = 0; i < chain.length; i++)
        {
            chain[i].setAbsolutePosition(pos[i]);
        }
    }
}
*/
