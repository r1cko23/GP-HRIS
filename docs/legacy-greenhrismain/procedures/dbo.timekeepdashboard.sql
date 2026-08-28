
-- =============================================
-- Author:		<Pat Relos
-- Create date: <1-14-2026>
-- Description:	<gete total no of pending and for correction>
-- =============================================
CREATE PROCEDURE [dbo].[timekeepdashboard]
--@clientstat nvarchar(30),
--@idorganization int

AS	

BEGIN

--declare @idclientlast int




SET NOCOUNT ON;
 

CREATE TABLE #TempTabledashboardtk(
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
	[Pending] NVARCHAR(30),	
	[forcorrection] NVARCHAR(30)	
   );

-- Insert data from the temp table into the #TempTable
CREATE INDEX idxid 
ON #TempTabledashboardtk (id);


INSERT INTO #TempTabledashboardtk ([Pending],[forcorrection])
		
	SELECT 
        COUNT(CASE WHEN tkstatus = 'Pending' THEN 1 END) AS noofpending,
        COUNT(CASE WHEN tkstatus = 'For Correction' THEN 1 END) AS noofforcorrection
    FROM 
    tbl_timekeep
	--where idclient = @idorganization




SELECT    * from    #TempTabledashboardtk

--select empid from #TempTable3 where departmentgroup = 'KRR_ Bacoor Junction'
--group by empid

-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTabledashboardtk;

END

