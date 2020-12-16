# VR Final Project: Avatar Control with Inverse Kinematics

**Due: Friday, December 18, 10:00pm CDT**

In this project, Avatar Control is provided through inverse kinematics. A user avatar will follow the users head, body, and arm positions through a scene. This document will provide Build URLs to showcase different modes of operation, the assets used, what tasks have been implemented with breif descriptions of them, and what tasks have not been implemented from the project proposal with brief reasoning as to why they where not.

## Submission Information

You should fill out this information before submitting your assignment.  Make sure to document the name and source of any third party assets such as 3D models, textures, or any other content used that was not solely written by you.  Include sufficient detail for the instructor or TA to easily find them, such as asset store or download links.

Names: Daniel Shervheim and Alexander Gullickson

UMN Email: sherv029@umn.edu and gulli172@umn.edu

Build URLs:
The build URLs are broken down into key section to showcase our work. The Calibration URL will enable assessment on the calibration UI and quality of calibration. Then, the URLs are broken down between a basic and complex scene for both the BabylonJS BoneIKController implementation and our own CCD implementation. This allows assement on the quality of each of them in both a basic scene and determine how well they work in a scene more indicative of an actual environment where the avatars would be used.
TODO: Add build URLs DAN/ALEX
* Calibration: LINKS GO HERE
* BoneIK Basic Scene: LINKS GO HERE
* BoneIK Studio Scene: LINKS GO HERE
* CCD Basic Scene: LINKS GO HERE
* CCD Studio Scene: LINKS GO HERE

Third Party Assets:

| Asset Type    | Asset Descriptor                                          | Asset Link                                                                                |
| ------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Model         | Avatar and Calibration Models                             | TODO:LINK GOES HERE |
| Model         | Studio Environment                                        | TODO:LINK GOES HERE |
TODO: any other assets DAN

## Tasks Implemented

1. Test Bed Setup:

    Created two different environments to evaluate user avatar control and inverse kinematics algorithm. The first environment is a basic environment which consists of a floor and 4 partial walls with mirrors. This is used to test the effectiveness of the avatar in the most basic of environments, and the avatar should update without any latency. The second environment is a more complex environment. That would require a not insignificant amount of computing power to render on its own. This is used to test the avatar latency in an environment more similiar to what it would be used in. The different environments can through the Build URLs linked above either the Basic or Studio Scenes. Alternatively, they can be selected by commenting out the let scene = new BasicScene(); or let scene = new StudioScene(); lines in the index.ts files.


2. Calibration Procedure:

    A calibration procedure was developed to resize the avatars proportions to the users. The calibration procedure is initialized by pressing the "A" Button on the right controller. This spawns a calibration avatar to guide the user through the 3 main calibration process. Step 1 is initialization where the calibration avatar is in an idle pose with text prompt explaing the process below it. Step 2 animates the avatar into a T-Pose with a text prompt telling the user to Press the "A" Button after matching the pose. Step 3 informs the user the calibration process is complete and the calibration avatar performs a victory dance. The avatar is then scaled based on the controller and headset positions along with human body proportion ratios found online (TODO:LINK). The user can then press A again to hide the calibration avatar and text prompt. The calibration process decided on was kept simple with the single T-Pose to make it easier for the user to follow and produce less error prone results by the user not mathcing the poses exactly. Further calibrations poses like bending arms to get more precise arm measurements were also explored but did not produce any more accurate results than the single pose.

    **Note: The calibration procedure does not work correctly for the BoneIK implementation. It will only scale the users height and not their arm size. This is due to the BabylonJS implements their BoneIK controller. It gets the target meshes and bones and will always autoscale them to 1 after they have been scaled. Further details on this are explained in our milestone 4 report.

3. Get Body Forward Direction:

    The Body forward direction procedure was necessary to orient the user avatars torso in the general position of the user. As their is no torso tracking this needs to be approximated based the users head and hand positions. The general implementation of which was taken from this article (TODO:LINK). The gist of how it works is the average head forward vector is accuired from the last 50 frames. Additionally, the average forward vector of the controllers needs to be determined. This is done by effectively drawing a line between the two controllers positions. The cross product is then taken between the controllers line and a vector pointing straight down to get the forward direction perpendicular to the controllers line. The bodies forward direction is then updated when the headset forward direction and controllers forward direction are within 23 degrees of each other.

4. Avatar Head and User Movement:

    The avatars head and user movement needed to be tracked as they moved around the scene. The avatar's head bone was mapped to the headsets orientation with a correction factor when it came to the heads yaw movement to account for when the body's forward direction adjusted. The headset position was tracked as well to update the user position. At the time, this does not work perfectly, but it may be corrected before submission. It currently just updates to the users position. A known bug occurs when the user looks down the head set position has technically moved but the user did not move. This leads to the avatars body shifting forward unintentionaly.


5. Inverse Kinematics through Babylon JS BoneIK controller, so it was implemented and refined to test out the capabilities of it.

    BabylonJS provides their own Bone Inverse Kinematics which was implemented to the best of its capabilities. There are significant drawbacks to it detailed in full in the Milestone 4 writeup with the primary drawback being the inability to rescale bones and meshes. The implementation is applied to each arm and supports up to 2 bones (forearm and upperarm). The BoneIK algorithm will attempt to orient the arms to the controller's position when the bones are able to reach the position. The elbow rotation is set based on a pole target position. When the pole target was fixed in a position relative to the user, it was not able to reproduce a realistic elbow motion in a wide range of user poses. This lead to us developing a custom way of repositioning the pole target. A hidden mesh box surround the user with the sides of it at the shoulder width. When the controllers are between the shoulders, they are in the micropole position. When the controllers are outside of the shoulders they are in the macropole position. These two different regions lead to much more reliable shoulder positioning results. There is a small elbow repositioning when the threshhold is crossed, but the small flinch is worth it for the much more accurate accuracy.

6. Inverse Kinematics through CCD Algorithm:

    TODO:CCD ALGORITHM DAN

7. User Hand rotation:

   The inverse kinematic algorithms above only get the users hand to the correct position but they do not handle the correct hand rotation. In attempt was made at mapping the controllers rotations to the avatars hand rotations. This works somewhat okay when the hands are between the shoulders, but it fails when the controllers are further distances away. Our solution is to not even attempt to orient the hands when the controllers are not between the shoulders. We felt this was still acceptable as in most cases the fine hand orientations occur between the shoulders versus more coarse movements at further distances.


8. Teleportation Around Environment:

    Teleportation wasn't originally in our proposal, but we wanted to be able to get close to mirrors and navigate around our studio scene. To accomplish this, we adapted the teleportaition technique from Assignement 6. The only difference is the world moves and not the user when a teleportaion occurs. The reasoning is to prevent any issues with the calculations of the user forward direction.

    Teleportation is triggered by aimming the right controller at the ground then pushing up on their right thumbstick. A teleportation indicator will appear. The end rotation can be selected by rolling the controller in their hand.

9.  Expose API for Other Developer Deployment:

    In addition, we exposed basic API to enable other developers to deploy the avatar in their worlds.
    TODO:DAN FILL OUT
## Proposed Tasks Not Completed
1. User Avatar walking with animation blending was not implemented.
   This was initially proposed as a stretch goal but it never came to fruition for a multitude of reasons.
   1. BabylonJS does not natively support Skeleton animations when the bones are scaled after the animations are applied. This would mean that the calibration procedure would need to be abondoned. It could possibly be implemented by hacking together the rendering process, but to the best of our abilities, we could not find a way to implement this.
   2. In our own real world testing space (2 meters x 2 meters), there would not be enough room to detect users arm swinging. In this amount of space, we could take about 3 steps before reaching the end which did not feel like enough to get a reliably arm movement.
   3. Going along with the 2nd point, walking is not the ideal navigation technique for small user spaces which means additional navigation techniques are required anyways. It could potentially be used to enhance the effects of redirected walking or other more advanced navigation techniques, but these techniques would likely need to be developed in conjuction with animated walking to work fully.
   4. In general, when walking, the user is not looking at their feet unless they are being careful where they are stepping. In which case, the animated walking wasn't going to be stepping in the correct place anyways.

    Ultimately, it was decided based on the reasoning above to abandon the idea early to alot more time to further develop our other tasks implemented. To prevent distractions of the legs not moving as the user walks or turns, the legs were removed from the users avatar.


2. Other Inverse Kinematic algorithms were not implemented from the proposal like FABRIK.

    In the implementation process other algorithms were explored and considered. After early testing, it was apparent that CCD was the only algorithm that we would be able to get to work reasonably well in the alloted amount of time. Attempts at the other algorithms lead to early failures that would require significant development time to get working to an acceptable standard. Therefore, the decision was made to spend more time on getting the BoneIK and CCD implementations working to their best ability rather than more implementations that all worked at a subpar level.


## Local Development

After checking out the project, you need to initialize by pulling the dependencies with:

```
npm install
```

After that, you can compile and run a server with:

```
npm run start
```

It is possible to change the scene by changing which lines are commented out in /src/index.ts after line 12. In case only have one line uncommented.

```
// Instantiate a scene.
let scene = new BasicScene();
// let scene = new StudioScene();
// let scene = new SeparateScene();
```

Under the hood, we are using the `npx` command to both build the project (with webpack) and run a local http webserver on your machine.  The included ```package.json``` file is set up to do this automatically.  You do not have to run ```tsc``` to compile the .js files from the .ts files;  ```npx``` builds them on the fly as part of running webpack.

You can run the program by pointing your web browser at ```https://your-local-ip-address:8080```.

## Build and Deployment

After you have finished the assignment, you can build a distribution version of your program with:

```
npm run build
```

Make sure to include your assets in the `dist` directory.  The debug layer should be disabled in your final build.  Upload it to your public `.www` directory, and make sure to set the permissions so that it loads correctly in a web browser.  You should include this URL in submission information section of your `README.md` file.

This project also includes a `deploy.sh` script that can automate the process of copying your assets to the `dist` directory, deploying your build to the web server, and setting public permissions.  To use the script, you will need to use a Unix shell and have`rsync` installed.  If you are running Windows 10, then you can use the [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/install-win10).  Note that you will need to fill in the missing values in the script before it will work.

## License

Material for [CSCI 5619 Fall 2020](https://canvas.umn.edu/courses/194179) by [Evan Suma Rosenberg](https://illusioneering.umn.edu/) is licensed under a [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](http://creativecommons.org/licenses/by-nc-sa/4.0/).

The intent of choosing CC BY-NC-SA 4.0 is to allow individuals and instructors at non-profit entities to use this content.  This includes not-for-profit schools (K-12 and post-secondary). For-profit entities (or people creating courses for those sites) may not use this content without permission (this includes, but is not limited to, for-profit schools and universities and commercial education sites such as Coursera, Udacity, LinkedIn Learning, and other similar sites).

## Acknowledgments
TODO: Delete if not used
