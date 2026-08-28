-- =============================================
-- Author:		<Pat Relos
-- Create date: <1-16-2024>
-- Description:	<Client Chart>
-- =============================================
CREATE PROCEDURE [dbo].[dashboardclientgraph]
@clientstat nvarchar(30),
@idorganization int

AS	

BEGIN

--declare @idclientlast int

SET NOCOUNT ON;
 

CREATE TABLE #TempTabledashclientchart(
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
	[companyname] NVARCHAR(100),	
	[noofemployee] int	
   );

-- Insert data from the payroll_summary table into the #TempTable
CREATE INDEX idxcompanyname ON #TempTabledashclientchart (companyname);

INSERT INTO #TempTabledashclientchart (companyname,noofemployee)
		
SELECT  top 20  client.companyname, COUNT(Employee.Employee_id) AS noofemployee
FROM            Employee INNER JOIN
                         client ON Employee.idclient = client.idclient
WHERE        (client.clientstatus = N'Active') AND (client.idorganization = @idorganization)
GROUP BY Employee.idclient, client.companyname
order by noofemployee desc


SELECT * from    #TempTabledashclientchart order by noofemployee asc

-- Remember to drop the temporary table when you no longer need it
--DROP TABLE #TempTabledashclientchart;
END

