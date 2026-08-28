-- =============================================
-- Author:		<Pat Relos
-- Create date: <1-16-2024>
-- Description:	<SSS Complex>
-- =============================================
CREATE PROCEDURE [dbo].[dashboardemp]
@clientstat nvarchar(30),
@idorganization int

AS	

BEGIN

--declare @idclientlast int




SET NOCOUNT ON;
 

CREATE TABLE #TempTabledashboardemp(
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
	[noofempactive] NVARCHAR(30),	
	[noofempinactive] NVARCHAR(30)	
   );

-- Insert data from the payroll_summary table into the #TempTable
--CREATE INDEX idx ON #TempTableSSS (ID);



INSERT INTO #TempTabledashboardemp ([noofempactive],[noofempinactive])
		
    SELECT 
        COUNT(CASE WHEN status = 'Active' THEN 1 END) AS noofempactive,
        COUNT(CASE WHEN status = 'InActive' THEN 1 END) AS noofempinactive
    FROM 
        Employee	
		where idorganization = @idorganization


--update #TempTabledashboardemp
--set [noofempinactive] = (select COUNT(idclient) as inactiveclient from Employee where status = 'InActive')


SELECT    * from    #TempTabledashboardemp

--select empid from #TempTable3 where departmentgroup = 'KRR_ Bacoor Junction'
--group by empid

-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTabledashboardemp;

END

