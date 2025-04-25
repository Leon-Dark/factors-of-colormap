#setwd("c:\\Users\\13395\\Downloads\\osfstorage-archive\\supplementary materials\\supplementary materials\\data and analysis scripts")

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

d <- read.csv("c:/Users/13395/Downloads/osfstorage-archive/supplementary materials/supplementary materials/data and analysis scripts/exp1_data.csv")


d$modelChoice <- factor(d$modelChoice)
d$subjectid <- factor(d$subjectid)
d$colormap <- factor(d$colormap, levels=c('blue', 'viridis', 'blue-orange', 'jet'))

# compute log of color categorization and re-center
d$logColorCategorization <- log(d$colorCategorization) - log(min(d$colorCategorization))

d$model0 <- ifelse(d$modelChoice==0, 1, 0)
d$model1 <- ifelse(d$modelChoice==1, 1, 0)
d$model2 <- ifelse(d$modelChoice==2, 1, 0)

# model the bias in choosing target-1 (global) over target-2 (local)
# ================================================================

# consider only trials that were answered correctly
dModel <- subset(d, correct==1)
dModel$binaryChoice <- ifelse(dModel$modelChoice==2, 0, 1)

# model the odds of discriminating global over local features
modelGlobalVsLocal <- glmer(data=dModel, formula=binaryChoice~logColorCategorization + (1|subjectid) + (1|trial), family = binomial(link = "logit"))
summary(modelGlobalVsLocal)

# consider all trials and model the relationship between logColorCategorization and success
modelSuccess <- glmer(data=d, formula=correct~logColorCategorization + (1|subjectid) + (1|trial), family = binomial(link = "logit"))
summary(modelSuccess)

# plotting functions
# ==================
plotMeanByColorAndSubject <- function(meanColor, meanSubject)
{
  COLORS <- c("#f8766D", "#ff7f00", "#33a02c", '#619cff')
  meanColor$colormap <- factor(meanColor$colormap, levels=c('jet', 'blue-orange', 'viridis', 'blue'))
  meanSubject$colormap <- factor(meanSubject$colormap, levels=c('jet', 'blue-orange', 'viridis', 'blue'))
  
  p <- ggplot(data=meanColor, aes(y=colormap, color=colormap, fill=colormap, x=Mean))
  p <- p + geom_point(data=meanSubject, aes(y=colormap, x=Mean, color=colormap), stroke=0.5, size=4, alpha=0.125, position=position_jitter(width=0.025, height=0.15))
  p <- p + geom_point(shape=18, size=4.0, color='black')
  p <- p + geom_errorbar(color="black", aes(xmin=Trad.lower, xmax=Trad.upper, width=0.0, size=1), position=position_dodge(.9), size=0.4)
  p <- p + geom_vline(xintercept=0.5, size=0.3)
  p <- p + theme_minimal()
  p <- p + scale_fill_manual(values=COLORS)
  p <- p + scale_color_manual(values=COLORS)
  p <- p +  theme(axis.text=element_text(size=11))
  p
}

plotMeanByColorAndSubjectVertical <- function(meanColor, meanSubject)
{
  COLORS <- rev(c("#f8766D", "#ff7f00", "#33a02c", '#619cff'))
  LEVELS <- rev(c('jet', 'blue-orange', 'viridis', 'blue'))
  meanColor$colormap <- factor(meanColor$colormap, levels=LEVELS)
  meanSubject$colormap <- factor(meanSubject$colormap, levels=LEVELS)
  
  p <- ggplot(data=meanColor, aes(x=colormap, color=colormap, fill=colormap, y=Mean))
  p <- p + geom_point(data=meanSubject, aes(x=colormap, y=Mean, color=colormap), stroke=0.5, size=4, alpha=0.15, position=position_jitter(width=0.15, height=0.04))
  p <- p + geom_point(shape=18, size=4.0, color='black')
  p <- p + geom_errorbar(color="black", aes(ymin=Trad.lower, ymax=Trad.upper, width=0.0), position=position_dodge(.9), size=0.4)
  p <- p + theme_minimal()
  p <- p + scale_fill_manual(values=COLORS)
  p <- p + scale_color_manual(values=COLORS)
  p <- p + geom_hline(yintercept=2/6, size=0.3, linetype="dashed")
  p <- p +  theme(axis.text=element_text(size=11))
  p
}


plotMeanByColor <- function(meanD)
{
  p <- ggplot(data=meanD, aes(x=colormap, color=colormap, fill=colormap, y=Mean))
  p <- p + geom_bar(stat="identity", position=position_dodge())
  p <- p + geom_errorbar(color="black", aes(ymin=Trad.lower, ymax=Trad.upper, width=0.0), position=position_dodge(.9), size=0.2)
  p <- p + theme_minimal() 
  p  
}

plotChoiceProportion <- function()
{
  choice0 <- calcMeansBasic(d, model0~colormap)
  choice1 <- calcMeansBasic(d, model1~colormap)
  choice2 <- calcMeansBasic(d, model2~colormap)
  
  choice0$modelChoice <- 'not detected'
  choice1$modelChoice <- 'global'
  choice2$modelChoice <- 'local'
  
  means <- rbind(choice0, choice1, choice2)
  means$modelChoice <- factor(means$modelChoice, levels=c('not detected', 'global', 'local'))
  
  p <- ggplot(data=subset(means, modelChoice!=0), aes(x=colormap, fill=modelChoice, y=Mean))
  p <- p + geom_bar(position="stack", stat="identity")
  p <- p + theme_minimal()
  p <- p + scale_fill_manual(values=c("#dddddd", "#fc8d62", "#960897", "#8da0cb"))
  p <- p + scale_color_manual(values=c("#dddddd", "#fc8d62", "#960897", "#8da0cb"))
  p <- p +  theme(axis.text=element_text(size=11))
  p
}

plotBias <- function()
{
  choice0 <- calcMeansBasic(d, model0~colormap*subjectid)
  choice1 <- calcMeansBasic(d, model1~colormap*subjectid)
  choice2 <- calcMeansBasic(d, model2~colormap*subjectid)
  
  choice0$modelChoice <- 0
  choice1$modelChoice <- 1
  choice2$modelChoice <- 2
  
  subjmeans <- rbind(choice1) #, choice2
  subjmeans$choiceProportion <- choice1$Mean/(choice1$Mean+choice2$Mean)
  subjmeans$Mean <- subjmeans$choiceProportion
  
  # remove subjects who had 0 correct answers in one of the colormaps
  sprintf("removed %d subjectXcolormap entries due to 0 correct answers", length(subset(subjmeans, is.na(choiceProportion))$subjectid))
  subjmeans<-subset(subjmeans, !is.na(choiceProportion))
  
  choiceProportion <- calcMeansBasic(subjmeans, choiceProportion~colormap)
  p <- plotMeanByColorAndSubject(choiceProportion, subjmeans)
  p
}


plotDetectionRate <- function()
{
  subjectMeans <- calcMeansBasic(d, correct~subjectid*colormap)
  means <- calcMeansBasic(subjectMeans, Mean~colormap)
  plotMeanByColorAndSubjectVertical(means, subjectMeans) + ylim(0, 1)
}

# ===================================================
plotTime <- function()
{
  subjectMeans <- calcMeansBasic(d, responseTime~subjectid*colormap)
  means <- calcMeansBasic(subjectMeans, Mean~colormap)
  plotMeanByColor(means)
  
}

plotBiasAvg <- function()
{
  choice0 <- calcMeansBasic(d, model0~subjectid*colormap)
  choice1 <- calcMeansBasic(d, model1~subjectid*colormap)
  choice2 <- calcMeansBasic(d, model2~subjectid*colormap)
  
  choice0$modelChoice <- 0
  choice1$modelChoice <- 1
  choice2$modelChoice <- 2
  
  means <- rbind(choice0, choice1)
  means <- rbind(means, choice2)
  means$choicePortion <- choice1$Mean/(choice1$Mean+choice2$Mean)
  
  # remove from the average participants who answered all wrong in one of the colormaps
  # (can't meaningfully compute proprtions for those)
  means<-subset(means, !is.na(choicePortion))
  
  choiceMeans <- calcMeansBasic(means, Mean~colormap*modelChoice)
  portionMeans <- calcMeansBasic(means, choicePortion~colormap)
  plotMeanByColor(portionMeans)

  
  #p <- ggplot(data=choiceMeans, aes(x=modelChoice, color=colormap, fill=colormap, y=Mean))
  #p <- p + geom_bar(stat="identity", position=position_dodge())
  #p <- p + geom_errorbar(color="black", aes(ymin=Trad.lower, ymax=Trad.upper, width=0.0), position=position_dodge(.9), size=0.2)
  #p <- p + theme_minimal()
  #p
}

# 显示模型结果和生成图表
print("Model Results:")
print(summary(modelGlobalVsLocal))
print(summary(modelSuccess))

print("\nGenerating plots...")
print("1. Choice Proportion Plot:")
plotChoiceProportion()

print("\n2. Bias Plot:")
plotBias()

print("\n3. Detection Rate Plot:")
plotDetectionRate()

print("\n4. Response Time Plot:")
plotTime()

print("\n5. Average Bias Plot:")
plotBiasAvg()
