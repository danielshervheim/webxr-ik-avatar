# Assignment 5: Worlds in Miniature

**Due: Monday, November 2, 10:00pm CDT**

In this assignment, you will implement a classic 3D interaction technique that was first introduced in [Virtual Reality on a WIM: Interactive Worlds in Miniature](https://canvas.umn.edu/files/15994381/download?download_frd=1), a widely cited paper from the 1995 CHI conference.  To get started, you should first read this paper to familiarize yourself with how it is supposed to work.  Note that many design and implementation possibilities are discussed in the paper; we are only going to implement a subset of them.

## Submission Information

You should fill out this information before submitting your assignment.  Make sure to document the name and source of any third party assets such as 3D models, textures, or any other content used that was not solely written by you.  Include sufficient detail for the instructor or TA to easily find them, such as asset store or download links.

Name:

UMN Email:

Build URL:

Third Party Assets:

Bonus Challenge Instructions (if applicable):

## Rubric

Graded out of 20 points.  

1. After reading the WIM paper, you should have a general idea of how it is supposed to work.  Create a testbed suitable for experimenting with this technique, such as an indoor virtual environment. (1)

2. At least six objects in the virtual environment should be selectable using ray casting with the dominant hand controller.  Only one object should be selectable at a given time.  Provide some sort of visual feedback to indicate the currently selected object, such as the highlight layer, edge rendering, changing the material, or motion animation.  The floor, walls, and ceiling should not be selectable. (1)

3. The user should be able to move an object by pointing at it, holding down the trigger, and moving the laser pointer.  Additionally, while the object is being moved, the object distance should be controllable using the thumbstick.  You can copy and paste the code provided in [Lecture 12](https://github.com/CSCI-5619-Fall-2020/Lecture-12) to implement this functionality.  (1)

4. Create a world in miniature that is a scaled down copy of your original environment.  You can easily create copies of existing objects using an `InstancedMesh`.  The template code includes an example of how to do this. (1)

   *Note: If your room model does not have double-sided faces, then any walls or ceiling should disappear automatically when viewed from behind.  This is known as back-face culling.  However, if your view of the miniature world is blocked, you might need to remove or hide the ceiling manually.*

5. Attach the world in miniature to the controller in your non-dominant hand.  The miniature world should be scaled appropriately so that it is easy to view from a handheld perspective.  Make sure that the controller model does not block any part of the miniature world.  You can also choose to hide the controller model entirely. (2)

6. When an object in the virtual environment is selected using ray casting, its counterpart in the miniature world should be updated so that it is also selected.  The same applies for deselection.  (2)

7. When an object in the virtual environment is moved, the corresponding movement should also be applied to the miniature object, so that they appear to be synchronized. (2)

8. Objects in the miniature world should also be selectable using ray casting.  When a miniature object is selected, the original object should be updated so that it is also selected.  The same applies for deselection. (2)

9. Because they are within arm's reach, objects in the miniature world will be moved using a different method than their counterparts.  The user should be able to grab and move a selected miniature object by holding the grip (squeeze) button on the controller in their dominant hand.  Objects that are unselected should not be grabbable. (2)

10. When an object in the miniature world is moved, the corresponding movement should also be applied to the original object, so that they appear to be synchronized. (2)

11. Create a miniature object to represent the user's headset.  When the user moves and rotates their head, the miniature object should be synchronized so that it is always displays the user's current pose. When the user grabs the miniature object that represents their headset, their viewpoint should translate in the virtual environment.  In other words, you can grab and move yourself around the world.  You only need to worry about position; rotation does not need to be modified.  (4)

    *Hint: the easiest way to do this is not by moving the nodes created by WebXR.  Instead, apply the reverse translation to the virtual environment.*

**Bonus Challenge:** Assuming the above requirements are implemented correctly, it should be possible to manipulate both the position and rotation of objects in the miniature world by simply grabbing them.  However, there is not currently a way to change the scale of objects.  For the bonus challenge, you should implement this functionality.  You can choose to implement scale manipulation for either the original object or the miniature object, or both.  However, the appearance of objects should always remain synchronized.  The technique should be spatial (not solely accomplished through buttons or thumbsticks), and it should be something different from the scaling manipulation implemented in Lecture 13.  Other than those requirements, you are free to implement any scaling technique that you want.  Creativity is encouraged!  You should also include instructions in your readme file, so we know how to test your technique when grading these assignments.  (2)

Make sure to document all third party assets. ***Be aware that points will be deducted for using third party assets that are not properly documented.***

## Submission

You will need to check out and submit the project through GitHub classroom.  The project folder should contain just the additions to the sample project that are needed to implement the project.  Do not add extra files, and do not remove the `.gitignore` file (we do not want the "node_modules" directory in your repository.)

**Do not change the names** of the existing files.  The TA needs to be able to test your program as follows:

1. cd into the directory and run ```npm install```
2. start a local web server and compile by running ```npm run start``` and pointing the browser at your ```index.html```

Please test that your submission meets these requirements.  For example, after you check in your final version of the assignment to GitHub, check it out again to a new directory and make sure everything builds and runs correctly.

## Local Development

After checking out the project, you need to initialize by pulling the dependencies with:

```
npm install
```

After that, you can compile and run a server with:

```
npm run start
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

This assignment was partially based upon content from the [3D User Interfaces Fall 2020](https://github.blairmacintyre.me/3dui-class-f20) course by Blair MacIntyre.
