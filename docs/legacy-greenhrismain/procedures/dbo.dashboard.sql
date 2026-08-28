-- =============================================
-- Author:		<Pat Relos
-- Create date: <1-16-2024>
-- Description:	<SSS Complex>
-- =============================================
CREATE PROCEDURE [dbo].[dashboard]
@clientstat nvarchar(30),
@idorganization int

AS	

BEGIN

--declare @idclientlast int




SET NOCOUNT ON;
 

CREATE TABLE #TempTabledashboard(
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
	[clientnoofclientactive] NVARCHAR(30),	
	[clientnoofclientinactive] NVARCHAR(30)	
   );

-- Insert data from the payroll_summary table into the #TempTable
--CREATE INDEX idxclientstatus ON #TempTableSSS ();



INSERT INTO #TempTabledashboard ([clientnoofclientactive],[clientnoofclientinactive])
		
	SELECT 
        COUNT(CASE WHEN clientstatus = 'Active' THEN 1 END) AS noofempactive,
        COUNT(CASE WHEN clientstatus = 'InActive' THEN 1 END) AS noofempinactive
    FROM 
    client
	where idorganization = @idorganization










SELECT    * from    #TempTabledashboard

--select empid from #TempTable3 where departmentgroup = 'KRR_ Bacoor Junction'
--group by empid

-- Remember to drop the temporary table when you no longer need it
--DROP TABLE #TempTabledashboard;

END

