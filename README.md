VolleyVision (p5.js)
A p5.js prototype that annotates volleyball sets from video and reports metrics (peak height, set width). Built for athlete self-analysis and empowerment.

Run locally
- Step 1: Install Visual Studio Code (VS Code): Download it from https://code.visualstudio.com/, run the installer, and Launch VS Code
- Step 2: Click the Extensions icon (left toolbar) in VS Studio (fifth from the bottom), search Live Server (by Ritwick Dey), and click Install.
- Step 3: In Github https://github.com/laralimbrick/volleyvision, click on the big green button that says '<>Code', scroll down to the bottom and click 'Download Zip'.
- Step 4: Unzip the the downloaded file - volleyvision-main.zip to its directory volleyvision-main
- Step 5: Open the folder just extracted (volleyvision-main) in VS Code, go to File ▸ Open Folder…, select the volleyvision_ folder, and you should see these files: index.html, sketch.js, and assets-stupid-training-720p.mp4
- Step 6: Expand the volleyvision-main folder in VS code, find the 'index.html' file, right click and choose the 'Open with Live Server' option. This will run the project
- Step 7: Click once to start the video, then use:

N = end rep and hide until end
Z = undo point
Space = play/pause , / . = frame step
S = restart hidden

On first run, follow the on-screen calibration prompts (click net bottom/top at left and right antennae).

Pause video once ball reaches the hands of the setter (second touch), and click the screen.
Let the ball reach its peak height in the set, pause the video and click the screen where the ball is again.
Finally, let the ball contact the hand of the hitter, pause the video and click the screen where the ball makes contact.
Press the 'n' key to start a new rep.

#Files
index.html – page and p5.js includes
sketch.js – all prototype logic
stupid training.mp4 – sample video (tracked with Git LFS)

#Notes
The video goes through approximately 13 reps before video is complete. 
