library(lme4)
library(lmerTest)
library(merTools)
library(ggplot2)
library(ggthemes)
library(rcompanion)
library(dplyr)
library(RColorBrewer)
library(emmeans)

# utility to compute averages +/- 95% CI
calcMeansBasic <-function(Data, formula)
{
  d<-groupwiseMean(formula,
                   data = Data,
                   conf = 0.95,
                   digits = 3,
                   R = 0,
                   boot = FALSE,
                   traditional = TRUE,
                   normal = FALSE,
                   basic = FALSE,
                   percentile = FALSE,
                   bca = FALSE
  )
  d$y <- d$Mean
  d
}

dist <- read.csv('exp3_summary.csv')
d <- read.csv("exp3_data.csv")

# Histogram of toggle counts per subject shows a bimodal distribution:
# those who have used the colors toggle feature frequently vs. participants
# who haven't used at all or used very infrequently
# we therefore split the data in half along the median usage frequency
medianUsage <- median(dist$sumToggleCount)
dist$toggler = dist$sumToggleCount > medianUsage

# split subjects who have used color toggle from the rest
toggleSubjects <- subset(dist, sumToggleCount >= medianUsage)
noToggleSubjects <- subset(dist, sumToggleCount < medianUsage)
sprintf("participants who have used the colormap toggle feature: %d vs. non-users: %d", length(toggleSubjects$subjectid), length(noToggleSubjects$subjectid))

# expand data frame adding a column on whether subject was a "toggler"
d$toggler <- rep(0, length(d$subjectid))
for (subid in toggleSubjects$subjectid) {
  d$toggler[d$subjectid == subid] <- 1
}
d$toggler <- factor(d$toggler)

# check if toggler vs. non-togglers have similar levels of engagement
# x100 so that numbers are more intuitive
e1 <- 100 * subset(dist, toggler==0)$engagement
e2 <- 100 * subset(dist, toggler==1)$engagement
mean(e2)-mean(e1)
t.test(e1, e2)

# modeling
# ========
# likelihood of correct answer based on whether a subject was a toggler
mCorrectToggler <- glmer(correct~toggler + (1|trial) + (1|block) + (1|subjectid), data=d, family = binomial(link = "logit"))
summary(mCorrectToggler)

# likelihood of final colormap being favored for the type of target shown
d$colormapMatch <- ifelse(d$finalColormap == d$targetType, 1, 0)
mMatchToggler <- glmer(colormapMatch~toggler + (1|trial) + (1|block) + (1|subjectid), data=d, family = binomial(link = "logit"))

# time spent looking at favored colormap as a fraction of total time (on a per stimulus basis)
d$totalColormapTime <- d$colormap1Time + d$colormap2Time
d$favoredColormapTime <- ifelse(d$targetType == 1, d$colormap1Time/d$totalColormapTime, d$colormap2Time/d$totalColormapTime)

# aggregate by subject
timeBySubject <- calcMeansBasic(d, favoredColormapTime~subjectid)
timeBySubject$favoredColormapTime <- timeBySubject$Mean
timeBySubject$toggler <- 0
for (subid in toggleSubjects$subjectid) {
  timeBySubject$toggler[timeBySubject$subjectid == subid] <- 1
}

# t.test that the distribution for togglers is NOT centered around 0.5 
# (i.e., rather 50-50 time for either colormap, we would expect to see a bias with more time spent using colormap by target)
t.test(subset(timeBySubject, toggler==1)$favoredColormapTime - 0.5)

# plotting functions
# ==================

plotMeansSubj <- function(subjMeans)
{
  subjMeans$togglerLabel <- ifelse(subjMeans$toggler==1, 'Switched\ncolormaps', 'Didn\'t\nswitch')
  subjMeans$togglerLabel <- factor(subjMeans$togglerLabel, levels=c('Switched\ncolormaps', 'Didn\'t\nswitch'))
  allMeans <- calcMeansBasic(subjMeans, y~toggler + togglerLabel) 
  
  p <- ggplot(data=allMeans, aes(x=togglerLabel, y=Mean))
  p <- p + geom_point(data=subjMeans, aes(x=togglerLabel, y=Mean, color=togglerLabel), stroke=0, size=5.0, alpha=0.25, position=position_jitter(width=0.15, height=0.0))
  p <- p + geom_point(shape=18, size=4.0)
  p <- p + geom_errorbar(aes(ymin=Trad.lower, ymax=Trad.upper), width=0)
  p <- p + theme_minimal()

  p <- p + scale_color_manual(values=c("#ff8000", "#00bfff"))
  p
}

plotAccuracy <- function()
{
  accuracyBySubj <- calcMeansBasic(d, correct~subjectid + toggler)
  plotMeansSubj(accuracyBySubj)
}

plotFavoredProb <- function()
{
  favoredBySubj <- calcMeansBasic(d, colormapMatch~subjectid + toggler)
  p <- plotMeansSubj(favoredBySubj)
  #p <- p + geom_hline(yintercept=0.5, size=0.2)
  #p <- p + geom_label(label="chance", y=0.5, x="Switched\ncolormaps", color = "black")
  p
}

plotFavoredTime <- function()
{
  favoredBySubj <- calcMeansBasic(d, favoredColormapTime~subjectid + toggler)
  p <- plotMeansSubj(favoredBySubj)
  p <- p + geom_hline(yintercept=0.5, size=0.2)
  p
}

plotColormapTime <- function()
{
  switchers <- subset(d, toggler==1)
  colormap1T <- data.frame(subjectid=switchers$subjectid, time=switchers$colormap1Time/1000, colormap='blue-orange')
  colormap2T <- data.frame(subjectid=switchers$subjectid, time=switchers$colormap2Time/1000, colormap='blue')
  times <- rbind(colormap1T, colormap2T)
  times$colormap=factor(times$colormap, levels=c('blue', 'blue-orange'))
  timesBySubj <- calcMeansBasic(times, time~subjectid*colormap)
  timesMean <- calcMeansBasic(timesBySubj, Mean~colormap)
  
  tTest <- t.test(subset(timesBySubj,colormap=='blue')$Mean, subset(timesBySubj,colormap=='blue-orange')$Mean, paired = TRUE)
  
  p <- ggplot(data=timesMean, aes(x=colormap, y=Mean))
  p <- p + geom_point(data=timesBySubj, aes(x=colormap, y=Mean), color='#555555', stroke=0, size=5.0, alpha=0.2, position=position_jitter(width=0.15, height=0.0))
  p <- p + geom_point(shape=18, size=4.0)
  p <- p + geom_errorbar(aes(ymin=Trad.lower, ymax=Trad.upper), width=0)
  p <- p + theme_minimal()
  p
}

plotToggleDist2 <- function()
{
  dist$togglerLabel <- ifelse(dist$toggler==1, 'Switched\ncolormaps', 'Didn\'t\nswitch')
  dist$togglerLabel <- factor(dist$togglerLabel, levels=c('Didn\'t\nswitch', 'Switched\ncolormaps'))
  toggleAvg <- calcMeansBasic(dist, sumToggleCount~toggler + togglerLabel)
  
  p <- ggplot(data=toggleAvg, aes(x=Mean, y=togglerLabel))
  p <- p + geom_point(data=dist, aes(x=sumToggleCount, y=togglerLabel, color=togglerLabel), stroke=0, size=5, alpha=0.3, position=position_jitter(width=0.0, height=0.15))
  p <- p + geom_point(shape=18, size=4.0)
  #p <- p + geom_errorbar(aes(xmin=Trad.lower, xmax=Trad.upper), width=0)
  p <- p + theme_minimal()
  p <- p + scale_color_manual(values=c("#00bfff", "#ff8000"))
  #p <- p + ylim(-.6,.6)
  #p <- p + geom_vline(xintercept=medianUsage, size=0.2, linetype="dashed", )
  p + theme(axis.text=element_text(size=11))
}

plotToggleDist <- function()
{
  p <- ggplot(subset(dist), aes(x=sumToggleCount)) + geom_histogram(bins=7, fill="#888888") 
  p <- p + theme_minimal() + geom_hline(yintercept=0.0, size=0.2)
  p
}

plotFavoredTimeDist <- function()
{
  p <- ggplot(subset(timeBySubject, toggler==1), aes(x=favoredColormapTime)) + geom_histogram(bins=15, fill="#888888") + theme_minimal()
  p + geom_hline(yintercept=0.0, size=0.2) + geom_vline(xintercept=0.5, size=0.5, color="#ffaa00")
}
