# WebXR IK Avatar

This repository contains work that [Alex Gullickson](mailto:gulli173@umn.edu) and myself did for [Evan Suma Rosenberg](https://illusioneering.cs.umn.edu)'s 3D VR user interfaces class.

We worked on an inverse kinematic solver for animating humanoid avatars in virtual reality.

- The IK solver takes the WebXR controller and head positions and computes a skeleton position from them, and then applies it to a humanoid avatar mesh.

- Currently only upper body (head, neck, shoulders, and arms) are supported by our solver.

## /implementation

contains the BabylonJS implementation of our proposed method.

## /paper

contains the latex source and a PDF copy of the paper describing our method.
